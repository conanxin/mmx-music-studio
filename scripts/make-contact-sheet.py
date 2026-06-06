#!/usr/bin/env python3
"""
Generate contact-sheet.png for mmx-music-studio UI review.
Automatically selects available Chinese font or falls back to English title.
No external network, no key access.
"""
from pathlib import Path
import sys

SHOT_DIR = Path("/home/ubuntu/projects/mmx-music-studio/docs/screenshots")
OUT_PATH = SHOT_DIR / "contact-sheet.png"

# Candidate Chinese fonts (ordered by preference)
FONT_CANDIDATES = [
    "/usr/share/fonts/truetype/NotoSansSC-Regular.ttf",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/truetype/arphic/uming.ttc",
]

# Screenshots to include
FILES = [
    "home-desktop.png",
    "studio-desktop.png",
    "home-mobile.png",
    "studio-mobile.png",
    "library-mobile.png",
    "settings-mobile.png",
    "docs-mobile.png",
]

def find_font():
    for f in FONT_CANDIDATES:
        p = Path(f)
        if p.exists():
            print(f"Using font: {f}")
            return f
    print("No Chinese font found, using English title")
    return None

def main():
    existing = [SHOT_DIR / f for f in FILES if (SHOT_DIR / f).exists()]
    if not existing:
        print("No screenshots found; skipping.")
        sys.exit(0)

    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception as e:
        print(f"Pillow unavailable: {e}")
        sys.exit(11)

    font_path = find_font()
    use_chinese = font_path is not None

    thumb_w = 360
    pad = 24
    label_h = 34
    bg = (9, 10, 12)
    panel = (18, 20, 25)
    text_col = (244, 241, 234)
    muted = (155, 161, 170)
    accent = (184, 255, 106)

    try:
        if use_chinese:
            font_title = ImageFont.truetype(font_path, 28)
            font_label = ImageFont.truetype(font_path, 16)
        else:
            font_title = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 28)
            font_label = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    except Exception:
        font_title = ImageFont.load_default()
        font_label = ImageFont.load_default()

    items = []
    for path in existing:
        img = Image.open(path).convert("RGB")
        ratio = img.height / img.width
        thumb_h = int(thumb_w * ratio)
        thumb = img.resize((thumb_w, thumb_h), Image.LANCZOS)
        items.append((path.name, thumb))

    cols = 2
    rows = (len(items) + cols - 1) // cols
    cell_w = thumb_w + pad * 2
    cell_h = max(t.height for _, t in items) + label_h + pad * 2
    canvas_w = cols * cell_w
    canvas_h = rows * cell_h + 90

    canvas = Image.new("RGB", (canvas_w, canvas_h), bg)
    draw = ImageDraw.Draw(canvas)

    title_text = (
        "MiniMax 音乐创作台 · UI 设计评审"
        if use_chinese
        else "MMX Music Studio · UI Design Review"
    )
    draw.text((pad, 24), title_text, fill=text_col, font=font_title)

    for i, (name, thumb) in enumerate(items):
        row = i // cols
        col = i % cols
        x = col * cell_w + pad
        y = 80 + row * cell_h + pad
        draw.rounded_rectangle(
            [x - 10, y - 10, x + thumb_w + 10, y + thumb.height + label_h + 10],
            radius=18,
            fill=panel,
        )
        canvas.paste(thumb, (x, y))
        draw.text((x, y + thumb.height + 10), name, fill=muted, font=font_label)

    canvas.save(OUT_PATH, "PNG")
    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"Created {OUT_PATH} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
