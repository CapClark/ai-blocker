#!/usr/bin/env python3
"""Generate the toolbar icons (teal tile with a 'no' / block symbol).

Dependency-free PNG encoder so the extension loads with real icons. Re-run
after changing the color or symbol: `python3 scripts/make_icons.py`.
"""
import os
import struct
import zlib

TEAL = (13, 148, 136, 255)   # #0d9488
WHITE = (255, 255, 255, 255)
SIZES = (16, 32, 48, 128)
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "icons")


def render(size):
    cx = cy = (size - 1) / 2.0
    r = size * 0.34          # ring radius
    th = max(1.0, size * 0.07)  # stroke half-thickness
    raw = bytearray()
    for y in range(size):
        raw.append(0)  # PNG filter type 0 (None) per scanline
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = (dx * dx + dy * dy) ** 0.5
            on_ring = abs(dist - r) <= th
            # diagonal bar of the "no" symbol (top-left -> bottom-right)
            on_slash = abs(dx + dy) <= th * 1.25 and dist <= r + th
            raw.extend(WHITE if (on_ring or on_slash) else TEAL)
    return bytes(raw)


def chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


def write_png(path, size):
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    idat = zlib.compress(render(size), 9)
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", ihdr)
           + chunk(b"IDAT", idat)
           + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for s in SIZES:
        write_png(os.path.join(OUT_DIR, f"icon{s}.png"), s)
        print(f"wrote icons/icon{s}.png")


if __name__ == "__main__":
    main()
