#!/usr/bin/env python3
"""BYOK smoke test HTTP helper — makes POST /api/generate and returns parsed results."""
import urllib.request, urllib.error, json, sys

def post_generate(port, key=None, prompt="smoke test"):
    body = json.dumps({"input": {"mode": "instrumental", "prompt": prompt}}).encode()
    headers = {"Content-Type": "application/json"}
    if key:
        headers["x-minimax-api-key"] = key
    req = urllib.request.Request(
        f"http://127.0.0.1:{port}/api/generate",
        data=body, headers=headers, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            resp_body = r.read().decode()
            return {"http_status": r.status, "body": resp_body, "error_type": None, "error_msg": None}
    except urllib.error.HTTPError as e:
        resp_body = e.read().decode()
        try:
            err = json.loads(resp_body)
            return {
                "http_status": e.code, "body": resp_body,
                "error_type": err.get("error", {}).get("type", "unknown"),
                "error_msg": err.get("error", {}).get("message", "")[:80]
            }
        except Exception:
            return {"http_status": e.code, "body": resp_body, "error_type": "parse_error", "error_msg": ""}
    except Exception as e:
        return {"http_status": None, "body": "", "error_type": "network_error", "error_msg": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 byok_http_helper.py <port> <key_or_empty>", file=sys.stderr)
        sys.exit(1)
    port = int(sys.argv[1])
    key = sys.argv[2] if sys.argv[2] != "__NONE__" else None
    result = post_generate(port, key)
    # Output as JSON on stdout — bash reads via backticks or $()
    print(json.dumps(result))
