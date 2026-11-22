import sys, glob, os
from PIL import Image, ImageDraw, ImageOps
d = sys.argv[1]; files = sorted(glob.glob(os.path.join(d, "gm_*.jpg")))
sizes = {l.split()[0]: (int(l.split()[1]), int(l.split()[2])) for l in open(os.path.join(d, "ukuran.txt")) if len(l.split()) == 3}
T, cols, per = 220, 10, 60
for p in range(0, len(files), per):
    chunk = files[p:p+per]; rows = (len(chunk)+cols-1)//cols
    S = Image.new("RGB", (cols*T, rows*T), "black"); dr = ImageDraw.Draw(S)
    for i, f in enumerate(chunk):
        try: im = ImageOps.fit(Image.open(f).convert("RGB"), (T-4, T-4))
        except Exception: continue
        x, y = (i % cols)*T, (i//cols)*T; S.paste(im, (x+2, y+2))
        n = os.path.basename(f)[3:6]; w, h = sizes.get(os.path.basename(f), (0, 0))
        dr.rectangle([x+2, y+2, x+120, y+22], fill="black"); dr.text((x+5, y+5), f"{n} {min(w,h)}{'P' if h>w else 'L'}", fill="yellow")
    S.save(os.path.join(sys.argv[2], f"sheet_{p//per+1}.jpg"), quality=80)
