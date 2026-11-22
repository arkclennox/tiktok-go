# Siapkan foto dari plan.json -> public/foto + src/config.json
#   putar sesuai EXIF, kecilkan pas layar 1080x1920 (+10% ruang gerak) dengan Lanczos, tajamkan sedikit.
#   Foto TIDAK PERNAH diperbesar diam-diam: kalau perlu diperbesar, dicetak "DIPERBESAR" -> ganti fotonya.
# Pakai: uv run --with pillow python -I prep.py
import json, os
from PIL import Image, ImageOps, ImageFilter
plan = json.load(open("plan.json"))
bahan = plan.get("bahan", "../bahan-gmaps")
os.makedirs("public/foto", exist_ok=True)
for s in plan["shots"] + [{"src": plan["card"]["photo"], "card": 1}]:
    im = ImageOps.exif_transpose(Image.open(os.path.join(bahan, s["src"]))).convert("RGB")
    w, h = im.size
    k = max(1188 / w, 2112 / h) if not s.get("card") else 300 / min(w, h)
    if k < 1:
        im = im.resize((round(w * k), round(h * k)), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    im.save(f"public/foto/{s['src']}", quality=95)
    if not s.get("card"):
        s["w"], s["h"] = im.size
        if k > 1.02: print("DIPERBESAR", s["src"], round(k, 2), "-> ganti dengan foto yang lebih besar")
json.dump(plan, open("src/config.json", "w"), indent=1)
print("ok", len(plan["shots"]), "shot")
