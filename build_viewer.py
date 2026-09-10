#!/usr/bin/env python3
"""Build a self-contained HTML viewer embedding the design strips as data URLs."""
import base64
import os

FILES = [
    ("authentication", "Authentication.png (1440x6399)"),
    ("ceo", "CEO.png (2545x32768)"),
    ("company_admin", "Company_Admin.png (2165x25497)"),
    ("design_sys", "Design.png - style guide (1920x3158)"),
    ("employee", "Employee / General User.png (1940x23692)"),
    ("hr", "HR / Department Head Role.png (1761x32768)"),
    ("md", "MD / EXECUTIVE.png (1012x32768)"),
    ("superadmin", "SUPER ADMIN.png (955x32768)"),
    ("teamlead", "Team Lead / Manager Role.png (2233x32278)"),
]
SRV = "design/served"

def data_uri(path):
    with open(path, "rb") as f:
        b = f.read()
    return "data:image/jpeg;base64," + base64.b64encode(b).decode()

parts = []
parts.append("""<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Hexovate design reader</title>
<style>
  html{scroll-behavior:auto}
  body{margin:0;background:#d9d9de}
  h2{margin:0;padding:10px 16px;font:600 19px/1.3 system-ui,sans-serif;color:#fff;background:#30303c;position:sticky;top:0;z-index:9}
  .strip{position:relative;background:#fff}
  img.seg{display:block;width:1500px;height:auto;background:#fff}
</style></head><body>""")

for stem, label in FILES:
    parts.append(f'<h2 id="{stem}">{label}</h2>\n<div class="strip">')
    files = sorted(
        f for f in os.listdir(SRV) if f.startswith(stem + "_") and f.endswith(".jpg")
    )
    for f in files:
        parts.append(f'<img class="seg" alt="{f}" src="{data_uri(os.path.join(SRV, f))}">')
    parts.append("</div>")

parts.append("</body></html>")

out = "design/reader_embedded.html"
with open(out, "w", encoding="utf-8") as f:
    f.write("\n".join(parts))
print(f"wrote {out}: {os.path.getsize(out)/1e6:.1f} MB")
