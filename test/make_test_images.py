#!/usr/bin/env python3
"""Generate test images that carry *declared* AI markers in their bytes.

PNGs embed the markers in tEXt/XMP chunks; JPEGs embed them in real APP1
segments (EXIF Software tag and an XMP packet) so both metadata paths are
exercised. Real-world markers live in EXIF/XMP/JUMBF; the parser only does a
substring scan, so this stays dependency-free (no Pillow needed).

Run: `python3 test/make_test_images.py`
"""
import os
import struct
import zlib

SIZE = 240
OUT = os.path.join(os.path.dirname(__file__), "images")

XMP = """<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/">
   <Iptc4xmpExt:DigitalSourceType>http://cv.iptc.org/newscodes/digitalsourcetype/{token}</Iptc4xmpExt:DigitalSourceType>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="r"?>"""


# --- shared ---------------------------------------------------------------

def crc_chunk(tag, data):
    return (struct.pack(">I", len(data)) + tag + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))


# --- PNG ------------------------------------------------------------------

def png_text(keyword, text):
    data = keyword.encode("latin1") + b"\x00" + text.encode("latin1")
    return crc_chunk(b"tEXt", data)


def png_pixels(rgb):
    raw = bytearray()
    for y in range(SIZE):
        raw.append(0)  # filter: None
        for x in range(SIZE):
            edge = x < 4 or y < 4 or x >= SIZE - 4 or y >= SIZE - 4
            raw.extend((255, 255, 255, 255) if edge else (*rgb, 255))
    return bytes(raw)


def write_png(path, rgb, metas):
    ihdr = struct.pack(">IIBBBBB", SIZE, SIZE, 8, 6, 0, 0, 0)
    body = b"".join(png_text(k, t) for k, t in metas)
    png = (b"\x89PNG\r\n\x1a\n"
           + crc_chunk(b"IHDR", ihdr)
           + body
           + crc_chunk(b"IDAT", zlib.compress(png_pixels(rgb), 9))
           + crc_chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)


# --- JPEG (minimal baseline encoder for a solid grayscale tile) -----------
# Standard Annex-K luminance Huffman tables.
BITS_DC = [0, 1, 5, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]
VALS_DC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
BITS_AC = [0, 2, 1, 3, 3, 2, 4, 3, 5, 5, 4, 4, 0, 0, 1, 0x7d]
VALS_AC = [
    0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07,
    0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1, 0x15, 0x52, 0xd1, 0xf0,
    0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x25, 0x26, 0x27, 0x28,
    0x29, 0x2a, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45, 0x46, 0x47, 0x48, 0x49,
    0x4a, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69,
    0x6a, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
    0x8a, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3, 0xa4, 0xa5, 0xa6, 0xa7,
    0xa8, 0xa9, 0xaa, 0xb2, 0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba, 0xc2, 0xc3, 0xc4, 0xc5,
    0xc6, 0xc7, 0xc8, 0xc9, 0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8, 0xd9, 0xda, 0xe1, 0xe2,
    0xe3, 0xe4, 0xe5, 0xe6, 0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8,
    0xf9, 0xfa,
]


def huffman(bits, vals):
    codes, code, k = {}, 0, 0
    for length in range(1, 17):
        for _ in range(bits[length - 1]):
            codes[vals[k]] = (code, length)
            code += 1
            k += 1
        code <<= 1
    return codes


DC = huffman(BITS_DC, VALS_DC)
AC = huffman(BITS_AC, VALS_AC)


class BitWriter:
    def __init__(self):
        self.acc = 0
        self.n = 0
        self.out = bytearray()

    def put(self, code, length):
        self.acc = (self.acc << length) | (code & ((1 << length) - 1))
        self.n += length
        while self.n >= 8:
            self.n -= 8
            b = (self.acc >> self.n) & 0xFF
            self.out.append(b)
            if b == 0xFF:
                self.out.append(0x00)  # byte stuffing

    def flush(self):
        if self.n:
            b = ((self.acc << (8 - self.n)) | ((1 << (8 - self.n)) - 1)) & 0xFF
            self.out.append(b)
            if b == 0xFF:
                self.out.append(0x00)
            self.n = 0


def seg(marker, payload):
    return bytes([0xFF, marker]) + struct.pack(">H", len(payload) + 2) + payload


def app1_exif(software):
    s = software.encode("latin1") + b"\x00"
    data_off = 8 + 2 + 12 + 4  # tiff header + ifd(count+entry+next)
    entry = struct.pack(">HHI", 0x0131, 2, len(s)) + struct.pack(">I", data_off)
    ifd = struct.pack(">H", 1) + entry + struct.pack(">I", 0)
    tiff = b"MM" + struct.pack(">H", 0x2A) + struct.pack(">I", 8) + ifd + s
    return seg(0xE1, b"Exif\x00\x00" + tiff)


def app1_xmp(xmp):
    return seg(0xE1, b"http://ns.adobe.com/xap/1.0/\x00" + xmp.encode("latin1"))


def jpeg_scan(level):
    bw = BitWriter()
    dc = level - 128            # quantized DC with Q[0]=8 (see DQT below)
    blocks = ((SIZE + 7) // 8) ** 2
    prev = 0
    for _ in range(blocks):
        diff = dc - prev
        prev = dc
        if diff == 0:
            bw.put(*DC[0])
        else:
            cat = abs(diff).bit_length()
            bw.put(*DC[cat])
            mag = diff if diff > 0 else diff + (1 << cat) - 1
            bw.put(mag, cat)
        bw.put(*AC[0])          # AC: end-of-block
    bw.flush()
    return bytes(bw.out)


def write_jpeg(path, level, app1_list):
    dqt = seg(0xDB, bytes([0x00]) + bytes([8] * 64))
    sof = seg(0xC0, bytes([8]) + struct.pack(">HH", SIZE, SIZE)
              + bytes([1, 1, 0x11, 0]))
    dht = seg(0xC4,
              bytes([0x00]) + bytes(BITS_DC) + bytes(VALS_DC)
              + bytes([0x10]) + bytes(BITS_AC) + bytes(VALS_AC))
    sos = seg(0xDA, bytes([1, 1, 0x00, 0x00, 0x3F, 0x00]))
    jpeg = (b"\xFF\xD8" + b"".join(app1_list)
            + dqt + sof + dht + sos + jpeg_scan(level) + b"\xFF\xD9")
    with open(path, "wb") as f:
        f.write(jpeg)


# --- fixtures -------------------------------------------------------------

PNGS = [
    ("ai-generated.png", (13, 148, 136),
     [("XML:com.adobe.xmp", XMP.format(token="trainedAlgorithmicMedia"))], "ai-generated"),
    ("ai-edited.png", (217, 119, 6),
     [("XML:com.adobe.xmp", XMP.format(token="compositeWithTrainedAlgorithmicMedia"))], "ai-edited"),
    ("ai-software.png", (124, 58, 237),
     [("Software", "Midjourney v6")], "ai-software"),
    ("content-credentials.png", (37, 99, 235),
     [("Comment", "claim_generator: DemoCam/1.0 (c2pa.actions, c2pa.hash.data)")], "content-credentials"),
    ("plain-photo.png", (107, 114, 128),
     [("Software", "Adobe Photoshop Lightroom Classic 13.0")], "none"),
]

JPEGS = [
    ("ai-generated.jpg", 150,
     [app1_xmp(XMP.format(token="trainedAlgorithmicMedia"))], "ai-generated (XMP APP1)"),
    ("ai-software.jpg", 95,
     [app1_exif("Adobe Firefly")], "ai-software (EXIF APP1)"),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, rgb, metas, verdict in PNGS:
        write_png(os.path.join(OUT, name), rgb, metas)
        print(f"wrote test/images/{name:26} -> expect '{verdict}'")
    for name, level, app1, verdict in JPEGS:
        write_jpeg(os.path.join(OUT, name), level, app1)
        print(f"wrote test/images/{name:26} -> expect '{verdict}'")


if __name__ == "__main__":
    main()
