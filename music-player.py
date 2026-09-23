#!/usr/bin/env python3
"""music-player - Generate a self-contained HTML vinyl record player from an audio file and images."""

import argparse
import base64
import json
import os
import re
import subprocess
import sys
from pathlib import Path

PLAYER_DIR = Path(__file__).resolve().parent
TEMPLATE_PATH = PLAYER_DIR / "template.html"

# Palettes to cycle through. Each sets the brass/room accent tokens in
# template.html's :root; --veil and --cover-shade control the gradient
# layers over backdrop/cover imagery (1.0 = fully dimmed imagery).
PALETTES = [
    {  # 0: brass & mahogany (default)
        "--bg-1": "#1b140f",
        "--bg-2": "#241b14",
        "--vinyl": "#100d0a",
        "--groove": "#2a2119",
        "--brass": "#c79a4b",
        "--brass-light": "#e6c789",
        "--cream": "#f2e9d8",
        "--muted": "#a9998c",
        "--veil": "0.72",
        "--cover-shade": "0.55",
    },
    {  # 1: blue hour
        "--bg-1": "#10141f",
        "--bg-2": "#161c2c",
        "--vinyl": "#0a0d16",
        "--groove": "#1c2438",
        "--brass": "#5b84c4",
        "--brass-light": "#9db8e2",
        "--cream": "#e8ecf5",
        "--muted": "#8b96ad",
        "--veil": "0.72",
        "--cover-shade": "0.55",
    },
    {  # 2: emerald lounge
        "--bg-1": "#0f1712",
        "--bg-2": "#15211a",
        "--vinyl": "#0a100c",
        "--groove": "#1e2c22",
        "--brass": "#4fa07a",
        "--brass-light": "#93c9ab",
        "--cream": "#e9f2ec",
        "--muted": "#8aa394",
        "--veil": "0.72",
        "--cover-shade": "0.55",
    },
    {  # 3: burgundy booth
        "--bg-1": "#1c1013",
        "--bg-2": "#26181c",
        "--vinyl": "#120a0d",
        "--groove": "#2c1d22",
        "--brass": "#c4576a",
        "--brass-light": "#e29aa6",
        "--cream": "#f5eaec",
        "--muted": "#ad8d94",
        "--veil": "0.72",
        "--cover-shade": "0.55",
    },
]

AUDIO_MIME = {
    ".m4a": "audio/mp4",
    ".mp4": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".aac": "audio/aac",
}

IMAGE_MIME = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".bmp": "image/bmp",
}


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    return text[:60].strip("-")


def media_to_base64(path: Path, table: dict, label: str) -> str:
    suffix = path.suffix.lower()
    mime = table.get(suffix)
    if not mime:
        opts = ", ".join(sorted(table))
        print(f"Unsupported {label} type: {suffix} (supported: {opts})", file=sys.stderr)
        sys.exit(1)
    data = base64.b64encode(path.read_bytes()).decode()
    return f"data:{mime};base64,{data}"


def build_html(name: str, artist: str, audio_b64: str, cover_b64: str,
               backdrop_b64: str, shade: float, palette: dict) -> str:
    template = TEMPLATE_PATH.read_text(encoding="utf-8")

    marker = "/* __TRACKLIST__ */"
    if marker not in template:
        print("template.html is missing the __TRACKLIST__ marker", file=sys.stderr)
        sys.exit(1)

    track = {
        "title": name,
        "artist": artist,
        "audioSrc": audio_b64,
        "coverImage": cover_b64,
        "backdropImage": backdrop_b64,
        "shade": shade,
    }
    tracklist_js = "const TRACKLIST = " + json.dumps([track], indent=2) + ";"

    html = template.replace(marker, tracklist_js)

    if palette:
        # Replace each palette token's value inside template.html's :root block.
        for key, value in palette.items():
            pattern = re.compile(r"(%s):\s*[^;]+;" % re.escape(key))
            html, n = pattern.subn(lambda m: m.group(1) + ": " + value + ";", html, count=1)
            if n == 0:
                print(f"Warning: palette token {key} not found in template.html", file=sys.stderr)

    return html


def open_in_browser(path: Path) -> None:
    if os.name == "nt":
        os.startfile(path)  # noqa: S606
    elif sys.platform == "darwin":
        subprocess.run(["open", str(path)], check=False)
    else:
        subprocess.run(["xdg-open", str(path)], check=False)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="music-player - Generate a self-contained HTML vinyl record player from an audio file and images."
    )
    parser.add_argument("-a", "--audio", required=True,
                        help="Audio file (m4a/mp3/wav/ogg/aac) - embedded as base64")
    parser.add_argument("-n", "--name", default=None,
                        help="Track title (default: derived from filename)")
    parser.add_argument("-A", "--artist", default="Unknown Artist",
                        help="Artist (default: Unknown Artist)")
    parser.add_argument("-i", "--image", default=None,
                        help="Full-page background image; a dimming gradient veil is laid over it")
    parser.add_argument("-c", "--cover", default=None,
                        help="Album art for the spinning disc (vignette shade applied)")
    parser.add_argument("-s", "--shade", type=float, default=0.72,
                        help="Backdrop dimming 0..1 (default: 0.72)")
    parser.add_argument("-p", "--palette", type=int, default=0,
                        choices=range(len(PALETTES)),
                        help=f"Palette index (0-{len(PALETTES)-1}, default: 0)")
    parser.add_argument("-o", "--out", default=None,
                        help="Output file (default: <music-player folder>/<slug>.html)")
    parser.add_argument("--open", action="store_true",
                        help="Open the generated file in the default browser")
    args = parser.parse_args()

    audio_path = Path(args.audio).expanduser().resolve()
    if not audio_path.exists():
        print(f"Audio file not found: {audio_path}", file=sys.stderr)
        sys.exit(1)

    cover_path = Path(args.cover).expanduser().resolve() if args.cover else None
    if cover_path and not cover_path.exists():
        print(f"Cover image not found: {cover_path}", file=sys.stderr)
        sys.exit(1)
    backdrop_path = Path(args.image).expanduser().resolve() if args.image else None
    if backdrop_path and not backdrop_path.exists():
        print(f"Background image not found: {backdrop_path}", file=sys.stderr)
        sys.exit(1)

    if not 0 <= args.shade <= 1:
        print("--shade must be between 0 and 1", file=sys.stderr)
        sys.exit(1)

    name = args.name or audio_path.stem.replace("_", " ").replace("-", " ").strip()
    if not name:
        name = "Untitled"

    print(f"Reading {audio_path.name}...")
    audio_b64 = media_to_base64(audio_path, AUDIO_MIME, "audio")
    size_mb = audio_path.stat().st_size / (1024 * 1024)
    print(f"  {size_mb:.1f} MB audio, embedded as base64 (~{size_mb * 1.33:.1f} MB in file)")

    cover_b64 = media_to_base64(cover_path, IMAGE_MIME, "image") if cover_path else ""
    backdrop_b64 = media_to_base64(backdrop_path, IMAGE_MIME, "image") if backdrop_path else ""
    if cover_path:
        print("Encoding cover art...")
    if backdrop_path:
        print("Encoding background image (gradient veil will be applied)...")

    print(f"Generating from template...")
    html = build_html(name, args.artist, audio_b64, cover_b64, backdrop_b64,
                      args.shade, PALETTES[args.palette])

    slug = slugify(name)
    output_path = (Path(args.out).expanduser().resolve() if args.out
                   else PLAYER_DIR / f"{slug}.html")
    output_path.write_text(html, encoding="utf-8")

    size_kb = output_path.stat().st_size / 1024
    print(f"Done! {size_kb:.0f} KB -> {output_path}")

    if args.open:
        print("Opening in browser...")
        open_in_browser(output_path)


if __name__ == "__main__":
    main()
