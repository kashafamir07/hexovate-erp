#!/usr/bin/env python3
"""Prepare design images for preview inspection.

Writes ./design/served/<name>_<seg>.jpg: vertical strips of the source canvas,
scaled to width 1500. Each segment is at most ~22000 px tall so the browser and
JPEG encoder stay happy, and strips give stable scroll anchors.
"""
import os
from PIL import Image

SRC_DIR = "design"
OUT_DIR = os.path.join(SRC_DIR, "served")
os.makedirs(OUT_DIR, exist_ok=True)

TARGET_W = 1500
MAX_SEG = 22000
FILES = ["authentication", "ceo", "company_admin", "design_sys",
         "employee", "hr", "md", "superadmin", "teamlead"]

def build(src_path, out_stem):
    with Image.open(src_path) as im:
        w, h = im.size
        scale = TARGET_W / w
        th = int(h * scale)
        offset = 0
        idx = 0
        while offset < th:
            seg_h = min(MAX_SEG, th - offset)
            s0 = int(offset / scale)
            s1 = int((offset + seg_h) / scale)
            s1 = min(h, s1 + 4)  # 4px source overlap
            chunk = im.crop((0, s0, w, s1))
            dst_h = int((s1 - s0) * scale)
            chunk = chunk.resize((TARGET_W, dst_h), Image.LANCZOS)
            # trim to exactly seg_h from the top (overlap at the bottom)
            if dst_h > seg_h:
                chunk = chunk.crop((0, 0, TARGET_W, seg_h))
            out = f"{out_stem}_{idx:02d}.jpg"
            chunk.convert("RGB").save(out, "JPEG", quality=80)
            print(f"{out}: {TARGET_W}x{seg_h}", flush=True)
            offset += seg_h
            idx += 1

for name in FILES:
    src = os.path.join(SRC_DIR, name + ".png")
    build(src, os.path.join(OUT_DIR, name))
print("done")
