# tile.py <folder_jpg> <keluar.jpg> [kolom]  — gabung gambar jadi satu lembar berlabel nama file (untuk dibaca agen)
import sys, glob, os
from PIL import Image, ImageDraw
fs = sorted(glob.glob(os.path.join(sys.argv[1], "*.jpg"))); cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
ims = [Image.open(f).convert("RGB") for f in fs]; w = 300; h = round(w * ims[0].height / ims[0].width)
rows = (len(ims) + cols - 1) // cols; S = Image.new("RGB", (cols * w, rows * h), "black"); d = ImageDraw.Draw(S)
for i, (f, im) in enumerate(zip(fs, ims)):
    x, y = (i % cols) * w, (i // cols) * h; S.paste(im.resize((w, h)), (x, y))
    lab = os.path.basename(f)[:-4]; d.rectangle([x, y, x + 7 * len(lab) + 8, y + 16], fill="black"); d.text((x + 4, y + 3), lab, fill="yellow")
S.save(sys.argv[2], quality=85); print(sys.argv[2], len(ims), "gambar")
