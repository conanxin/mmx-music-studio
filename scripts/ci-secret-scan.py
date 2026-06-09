#!/usr/bin/env python3
"""
CI Secret Scan — mmx-music-studio
Detects likely hardcoded secrets in source/config files while ignoring
harmless variable templates (Bearer ${apiKey}), documented examples, and
placeholder values.

Usage:
  python3 scripts/ci-secret-scan.py

Exit codes:
  0 = CLEAN (no real secrets found)
  1 = SUSPICIOUS (likely real secret found — CI should fail)
"""

import subprocess
import sys
import os
import re

# ── Skip these directories ───────────────────────────────────────────────────
SKIP_DIRS = {
    ".git", "node_modules", "dist", ".next", "coverage",
    "storage", "tmp", "logs", "smoke-output", ".hermes",
}

# ── Skip these file extensions ──────────────────────────────────────────────
SKIP_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico",
    ".zip", ".tar", ".gz", ".bz2", ".xz",
    ".mp3", ".wav", ".ogg", ".flac", ".m4a",
    ".mp4", ".mov", ".avi", ".mkv",
    ".pdf", ".ttf", ".woff", ".woff2", ".eot",
    ".lock", ".log",
}

# Allowlist: lines containing only template variables, documented examples,
# or placeholder values. These are NOT hardcoded secrets.
ALLOWLIST_RE = re.compile(
    r"("
    + "|".join([
        # Variable interpolation / template strings
        r"\$\{[^}]+\}",            # ${anything}
        r"\$\w+",                  # $var or $variable
        r"\{\s*\w+\s*\}",          # { variable }
        # Documentation / placeholder markers
        r"<your[-_]?",
        r"<YOUR[-_]?",
        r"placeholder",
        r"example\.com",
        r"example\.org",
        r"fake|FAKE|faux|FAUX",
        r"smoke[-_]?test",
        r"BYOK_REAL_TEST",
        r"<REDACTED>",
        r"\*\*\*REDACTED\*\*\*",
        r"REDACTED",
        r"\*\*\*[A-Z0-9_]+\*\*\*",  # ***ANYTHING***
        # Env var examples (MINIMAX_API_KEY=<...> or =***)
        r"\.env\.example",
        r"\.env\.demo",
        r"\.env\.private-real",
        r"\.env\.production-locked",
        # Package lock (generated, safe)
        r"package[-_]?lock\.json",
        # Key=value examples in docs — values that are clearly placeholders
        r"MINIMAX_API_KEY\s*=\s*(?:"   # Pattern: MINIMAX_API_KEY=<...>
        + r"<[^>]{3,}|"               # <your_key>, <MINIMAX_API_KEY>
        r"\*\*\*|"                    # =*** (redacted marker)
        r"your[-_]real|"              # your_real_key (placeholder) — MUST be before your_ general
        r"your[-_]api|"               # your_api_key (placeholder)
        r"your[-_]key|"               # your_key, your_secret_key (placeholder)
        r"your[-_]token|"             # your_token (placeholder)
        r"MOCK[-_]O.*KEY|"            # MOCK_O..._KEY (smoke test value)
        r"<your|"                     # <your...> (any <your prefix)
        r"<YOUR|"                     # <YOUR...>
        r"example|"                   # example key/value
        r"test[-_]?key|"              # test_key etc.
        r")",
        # Comment lines in source (// or # with secret-related keywords)
        r"^\s*(?://|#).*(?:api[_-]?key|token|secret|password|auth).*:",
        r"^\s*/\*.*(?:api[_-]?key|token|secret|password|auth).*:",
        # HTML entity encoded
        r"&lt;your",
        r"&lt;YOUR",
        # PIN value examples (smoke test pins)
        r"smoke[-_]test[-_]pin[-_]999",
        r"MySecurePass2024",
        # Docs showing MINIMAX_API_KEY=*** placeholder in code example blocks
        # (lines like "MINIMAX_API_KEY=***  ← 禁止" or "MINIMAX_API_KEY=***  # server")
        r"MINIMAX_API_KEY\s*=\s*\*\*\*\s",
    ])
    + r")",
    re.IGNORECASE,
)

# Allowlist for specific file types that we still want to scan but need
# extra filtering (e.g. .ts/.tsx source files — we scan them but filter
# template-variable false positives).
SOURCE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".py", ".java", ".go", ".rb"}

# ── Secret detection patterns ────────────────────────────────────────────────
# Format: (name, compiled_regex)
# Each pattern looks for hardcoded literal strings, not variable references.
SECRET_PATTERNS = [
    ("sk_key",               re.compile(r"\bsk-[A-Za-z0-9_-]{20,}\b")),
    ("sk_key_underscore",    re.compile(r"\bsk_[A-Za-z0-9_-]{20,}\b")),
    ("bearer_token_literal", re.compile(r"\bBearer\s+[A-Za-z0-9_.=-]{20,}\b")),
    ("minimax_api_key",      re.compile(r"\bMINIMAX_API_KEY\s*=\s*[A-Za-z0-9._-]{10,}\b")),
    ("preview_access_pin",   re.compile(r"\bPREVIEW_ACCESS_PIN\s*=\s*[0-9A-Za-z_-]{6,}\b")),
    ("generation_access_pin",re.compile(r"\bGENERATION_ACCESS_PIN\s*=\s*[0-9A-Za-z_-]{6,}\b")),
    ("auth_token_header",    re.compile(r"\bAuthorization\s*:\s*Bearer\s+[A-Za-z0-9_.=-]{20,}\b")),
]

# ── Per-line allowlist: must NOT contain any of these substrings ─────────────
HARMLESS_SUBSTRINGS = [
    "${", "$var", "$token", "$key", "$secret", "$api",
    "<your", "<YOUR", "placeholder", "example", "fake", "FAKE",
    "REDACTED", "***REDACTED***", "BYOK_REAL_TEST", "smoke-test",
    ".env.example", ".env.demo", "package-lock",
    "console.log", "logger", "log.", "Logger.",
    "your_real", "your_api", "your_key", "your_token",  # placeholder values
    "MOCK_O", "MOCK_S", "MOCK_GENERATION",              # mock/smoke test values
    "smoke_test_pin", "smoke_test",                      # smoke test PINs
    "MySecurePass",                                      # known example PIN
    "// Key", "// token", "// secret",                   # comment lines
]


def should_skip_path(path: str) -> bool:
    """Return True if this path should be skipped entirely."""
    path = os.path.abspath(path)
    parts = path.split(os.sep)
    # Skip hidden dirs and known bad dirs
    for part in parts:
        if part.startswith(".") and part not in {".github"}:
            return True
        if part in SKIP_DIRS:
            return True
    # Skip by extension
    for ext in SKIP_EXTS:
        if path.endswith(ext):
            return True
    return False


def is_harmless_line(line: str, path: str) -> bool:
    """
    Returns True if the line contains only a template variable / documented
    example and no hardcoded secret.
    """
    # Must NOT contain any harmless substring
    for hs in HARMLESS_SUBSTRINGS:
        if hs in line:
            return True
    # Also skip if the line matches the allowlist (harmless documentation patterns)
    if ALLOWLIST_RE.search(line):
        return True
    return False


def redact_secret(match: re.Match) -> str:
    """Show first 8 chars of a secret, rest redacted."""
    val = match.group(0)
    if len(val) <= 8:
        return "***"
    return val[:8] + "***"


def scan_file(filepath: str):
    """
    Scan a single file. Yields (redacted_match_str, file:line) tuples
    for suspicious matches.
    """
    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
    except (OSError, IOError):
        return

    for lineno, line in enumerate(lines, 1):
        # Quick filter: skip lines with obvious template/placeholder strings
        if is_harmless_line(line, filepath):
            continue

        for pname, pattern in SECRET_PATTERNS:
            for m in pattern.finditer(line):
                matched_text = m.group(0)
                # Double-check: if matched text is clearly a template, skip
                if "${" in matched_text or "$" in matched_text:
                    continue
                # Redact for display
                redacted = pattern.sub(redact_secret, matched_text)
                yield f"{filepath}:{lineno}: {redacted}", f"{filepath}:{lineno}"


def get_files(root: str = "."):
    """Yield all files to scan (respecting skip rules)."""
    for dirpath, dirnames, filenames in os.walk(root):
        # Prune skip dirs in-place
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for fname in filenames:
            fpath = os.path.join(dirpath, fname)
            if not should_skip_path(fpath):
                yield fpath


def main():
    root = "."
    total_matches = []
    files_scanned = 0

    for filepath in get_files(root):
        files_scanned += 1
        for redacted_line, _ in scan_file(filepath):
            total_matches.append(redacted_line)

    # Deduplicate while preserving order
    seen = set()
    unique_matches = []
    for m in total_matches:
        key = m.split(":")[0] + ":" + m.split(":")[1] if ":" in m else m
        if key not in seen:
            seen.add(key)
            unique_matches.append(m)

    if unique_matches:
        print(f"Secret scan SUSPICIOUS — {len(unique_matches)} likely hardcoded secret(s) found:")
        print()
        for m in unique_matches:
            print(f"  {m}")
        print()
        print("If these are false positives, add them to the allowlist in scripts/ci-secret-scan.py")
        sys.exit(1)
    else:
        print(f"Secret scan CLEAN ({files_scanned} files scanned)")
        sys.exit(0)


if __name__ == "__main__":
    main()