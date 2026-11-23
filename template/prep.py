# Siapkan foto dari plan.json -> public/foto + src/config.json (+ efek suara -> public/sfx)
#   putar sesuai EXIF, kecilkan pas ukuran tampil (+8% ruang gerak) dengan Lanczos, tajamkan sedikit.
#   Ukuran tampil tergantung tata letak shot: full 1080x1920, split2 1080x954, split3 1080x632, grid4 534x954, frame 900 lebar.
#   Foto TIDAK PERNAH diperbesar diam-diam: kalau perlu diperbesar, dicetak "DIPERBESAR" -> ganti fotonya.
# Pakai: uv run --with pillow python -I prep.py
import json, os, shutil
from PIL import Image, ImageOps, ImageFilter
plan = json.load(open("plan.json"))
bahan = plan.get("bahan", "../bahan-gmaps")
os.makedirs("public/foto", exist_ok=True)
BOX = {"full": (1080, 1920), "split2": (1080, 954), "split3": (1080, 632), "grid4": (534, 954), "frame": (900, 900)}
bad = 0
def prep(src, box, card=False, z=1):
    global bad
    im = ImageOps.exif_transpose(Image.open(os.path.join(bahan, src))).convert("RGB")
    w, h = im.size
    if card: k = 300 / min(w, h)
    elif box == "frame": k = 900 * 1.08 / w
    else: k = max(BOX[box][0] * 1.1 / w, BOX[box][1] * 1.1 / h) * z  # z = zoom dasar shot (plan "z")
    if k < 1: im = im.resize((round(w * k), round(h * k)), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    out = f"public/foto/{src}"
    if os.path.exists(out):  # foto dipakai dua kali di ukuran berbeda: simpan yang terbesar
        if Image.open(out).size[0] >= im.size[0]: im = Image.open(out)
    im.save(out, quality=95)
    if not card and k > 1.02: print("DIPERBESAR", src, box, round(k, 2), "-> ganti dengan foto yang lebih besar"); bad += 1
    return im.size
for s in plan["shots"]:
    lay = s.get("layout", "full")
    box = "full" if lay == "full" else lay
    s["w"], s["h"] = prep(s["src"], box, z=s.get("z", 1))
    ex = []
    for e in s.get("extra", []):
        src = e if isinstance(e, str) else e["src"]
        w, h = prep(src, box); ex.append({"src": src, "w": w, "h": h})
    s["extra"] = ex
prep(plan["card"]["photo"], "full", card=True)
# efek suara: kunci -> nama file di ~/sfx (CC0). Lokasi bisa diubah lewat ~/.config/tiktok-go/config.json "sfxDir".
SFX = {"whoosh": "whoosh/transition-whoosh-sound.mp3", "swish": "whoosh/whoosh-2.mp3", "shutter": "ui/ios-camera-flash.mp3", "thud": "impact/big-thud2.mp3",
       "pop": "ui/pop-sound.mp3", "glitch": "glitch/glitch.mp3", "shimmer": "notification/sparkle.mp3", "click": "ui/click-soft.mp3", "coin": "notification/coin-get.mp3"}
SFX.update(plan.get("sfx", {}))
cfg = {}
try: cfg = json.load(open(os.path.expanduser("~/.config/tiktok-go/config.json")))
except Exception: pass
sdir = os.path.expanduser(cfg.get("sfxDir", "~/sfx"))
files = {}
if plan.get("sfxOff"): sdir = ""
for k, rel in SFX.items():
    p = os.path.join(sdir, rel) if sdir else ""
    if p and os.path.exists(p):
        os.makedirs("public/sfx", exist_ok=True); name = rel.replace("/", "_"); shutil.copyfile(p, f"public/sfx/{name}"); files[k] = name
if not files: print("PERINGATAN tidak ada efek suara (sfxDir tidak ditemukan) -> video tanpa SFX")
plan["sfxFiles"] = files
# warna brand akun pemilik (lokal, tidak di repo)
if cfg.get("brand"): plan["brand"] = {k: v for k, v in cfg["brand"].items() if k in ("name", "light", "mid", "deep")}
else: print("PERINGATAN brand belum diatur di ~/.config/tiktok-go/config.json -> warna aksen dari look.accent")
# musik latar (CC0, ~/sfx/musik). Titik mulai digeser supaya ketukan jatuh tepat di potongan shot (beat-sync).
M = plan.get("music")
if M and not plan.get("musicOff"):
    import subprocess
    src = os.path.join(sdir or os.path.expanduser("~/sfx"), M["file"])
    if not os.path.exists(src): print("PERINGATAN musik tidak ada:", src)
    else:
        shutil.copyfile(src, "public/music.mp3")
        beats = []
        try:
            out = subprocess.run(["npx", "hyperframes", "beats", src, "--json"], capture_output=True, text=True, timeout=300).stdout
            beats = json.loads(out).get("beatTimes", [])
        except Exception as e: print("PERINGATAN deteksi ketukan gagal:", e)
        W = json.load(open("src/words.json"))
        def st(s):
            L = W["lines"][s["line"] - 1]
            return 0 if (s["line"] == 1 and not s.get("word")) else next((w["start"] for w in L["words"] if w["show"] == s.get("word")), L["start"])
        cuts = [st(s) for s in plan["shots"][1:]]
        best = (M.get("offset", 0), -1)
        if beats:
            for k in range(0, 400):
                off = M.get("searchFrom", 0) + k * 0.01
                bb = [b - off for b in beats if b >= off]
                hit = sum(1 for c in cuts if any(abs(c - b) < 0.06 for b in bb))
                if hit > best[1]: best = (round(off, 2), hit)
            print(f"musik {M['file']}: mulai {best[0]} s, {best[1]}/{len(cuts)} potongan tepat di ketukan")
        plan["music"] = {"src": "music.mp3", "offset": best[0], "volume": M.get("volume", 0.13)}
json.dump(plan, open("src/config.json", "w"), indent=1)
print("ok", len(plan["shots"]), "shot,", len(files), "sfx", "| DIPERBESAR:" if bad else "", bad if bad else "")
