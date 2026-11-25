# lint.py — PEMERIKSAAN OTOMATIS sebelum VO/render. Pakai: uv run --with pillow python -I lint.py
# Gagal (SALAH) = wajib diperbaiki. PERINGATAN = periksa dan putuskan.
import json, os, re, glob, sys
SK = os.environ.get("TIKTOK_GO_HOME") or os.path.expanduser("~/.agents/skills/tiktok-go")
S = json.load(open("script.json")); P = json.load(open("plan.json"))
err, warn = [], []
lines = S["lines"]; txt = " ".join(lines).lower()
# 1. kata pinjaman Inggris yang salah diucapkan ElevenLabs (lihat references/pelajaran.md) — tambah di sini bila ketemu kata baru
BANNED = ["booking", "book", "check-in", "check in", "checkin", "check-out", "homestay", "rate", "staycation", "pool", "breakfast", "room", "free"]
for b in BANNED:
    if re.search(r"(?<![\w-])" + re.escape(b) + r"(?![\w-])", txt): err.append(f"kata Inggris '{b}' di naskah -> pakai kata Indonesia (pesan, masuk kamar, kolam renang, sarapan)")
if re.search(r"\bdi jember satu ini\b|\bsatu ini\b", txt): err.append("frasa 'satu ini' terdengar aneh (masukan pemilik)")
for i, l in enumerate(lines, 1):
    if l.strip().endswith("!"): warn.append(f"baris {i} diakhiri '!' -> nada sering naik/tidak cocok (masukan pemilik), pakai titik")
    if len(l.split()) > 16: warn.append(f"baris {i} {len(l.split())} kata, terlalu panjang untuk satu napas")
if not 10 <= len(lines) <= 14: warn.append(f"{len(lines)} baris; biasanya 11-13 baris = 33-42 detik")
if abs(S.get("overlap", 0) - 0.3) > 0.001: warn.append("overlap bukan 0.3 detik (permintaan pemilik)")
T = S.get("tts", {"provider": "elevenlabs"})
if T.get("provider") not in ("elevenlabs", "openai", "voicestudio", "command", "files"): err.append(f"penyedia tts '{T.get('provider')}' tidak dikenal (lihat references/tts.md)")
if T.get("provider") == "command" and not T.get("command"): err.append('tts.command kosong (contoh: ["say","-v","Damayanti","-o","{out}.aiff","{text}"])')
if T.get("provider") != "elevenlabs": warn.append(f"penyedia tts '{T.get('provider')}': waktu kata dari whisper/bagi rata — cek sinkron caption di out/cek-shot")
# 2. tidak boleh mirip naskah lama (pemilik: 'terlalu monoton, terlalu mirip video pertama')
def grams(t, n=3):
    w = re.sub(r"[^\w\s]", " ", t.lower()).split(); return {" ".join(w[i:i + n]) for i in range(len(w) - n + 1)}
me = grams(" ".join(lines))
for f in sorted(glob.glob(os.path.join(SK, "references/naskah/*.json"))):
    old = json.load(open(f))["lines"]
    if old == lines: continue
    og = grams(" ".join(old)); share = me & og
    ratio = len(share) / max(1, len(me))
    if ratio > 0.12: err.append(f"naskah {ratio:.0%} sama (3-kata) dengan {os.path.basename(f)}: {sorted(share)[:8]} -> tulis ulang dengan kata/struktur lain")
    for i, l in enumerate(lines, 1):
        for o in old:
            if len(grams(l, 4) & grams(o, 4)) >= 2: warn.append(f"baris {i} mirip baris lama di {os.path.basename(f)}: '{o}'")
# 3. rencana shot
srcs = [s["src"] for s in P["shots"]] + [e if isinstance(e, str) else e["src"] for s in P["shots"] for e in s.get("extra", [])]
for s in set(srcs):
    if srcs.count(s) > 1: err.append(f"foto {s} dipakai {srcs.count(s)}x")
bahan = P.get("bahan", "../bahan-gmaps"); uk = {}
if os.path.exists(os.path.join(bahan, "ukuran.txt")):
    for l in open(os.path.join(bahan, "ukuran.txt")):
        p = l.split()
        if len(p) == 3: uk[p[0]] = (int(p[1]), int(p[2]))
for s in P["shots"]:
    if not os.path.exists(os.path.join(bahan, s["src"])): err.append(f"{s['src']} tidak ada di {bahan}"); continue
    BOXL = {"full": (1188, 2112), "split2": (1188, 1049), "split3": (1188, 695), "grid4": (587, 1049), "frame": (972, 0)}
    bx = BOXL[s.get("layout", "full")] if s.get("layout", "full") in BOXL else BOXL["full"]
    for src in [s["src"]] + [e if isinstance(e, str) else e["src"] for e in s.get("extra", [])]:
        w, h = uk.get(src, (0, 0))
        if w and max(bx[0] / w, bx[1] / h) > 1.02 and max(bx[0] / h, bx[1] / w) > 1.02: err.append(f"{src} {w}x{h} terlalu kecil untuk layout {s.get('layout','full')} -> akan diperbesar dan buram, ganti")
    if not 1 <= s["line"] <= len(lines): err.append(f"{s['src']} baris {s['line']} di luar naskah")
# kata pemicu shot harus ada (setelah vo.mjs)
if os.path.exists("src/words.json"):
    W = json.load(open("src/words.json"))
    if len(W["lines"]) != len(lines): warn.append("src/words.json belum sesuai naskah -> jalankan node vo.mjs")
    else:
        for s in P["shots"]:
            if s.get("word") and s["word"] not in [w["show"] for w in W["lines"][s["line"] - 1]["words"]]:
                err.append(f"kata pemicu '{s['word']}' tidak ada di baris {s['line']} (tampil: {' '.join(w['show'] for w in W['lines'][s['line']-1]['words'])})")
        # durasi shot (pelajaran Trans Luxury: pemicu di ujung kalimat -> shot 0,5 s)
        st = [0 if (s["line"] == 1 and not s.get("word")) else next((w["start"] for w in W["lines"][s["line"]-1]["words"] if w["show"] == s.get("word")), W["lines"][s["line"]-1]["start"]) for s in P["shots"]]
        for k, s in enumerate(P["shots"]):
            d = (st[k+1] if k+1 < len(st) else W["total"]) - st[k]
            if d < 0.8: err.append(f"durasi shot {s['src']} cuma {d:.2f} s -> pindah kata pemicu ke kata yang lebih awal atau buang shot")
            elif d > 4.5: warn.append(f"durasi shot {s['src']} {d:.2f} s, terlalu lama")
        if W["total"] > 45: warn.append(f"durasi {W['total']} s; acuan 33-42 s")
for s in P["shots"]:
    for e in s.get("extra", []):
        e = e if isinstance(e, str) else e["src"]
        if not os.path.exists(os.path.join(bahan, e)): err.append(f"foto extra {e} tidak ada di {bahan}")
# 3b. ANTI-MONOTON (aturan pemilik 2026-11-23: "caption, efek, transisi terlalu monoton"). Kosakata & sumber: references/gaya.md
TRANS = ["cut","flash","dip","leak","zoom","spin","whipL","whipR","whipU","whipD","push","drop","iris","slice","glitch"]
MOVES = ["zoomIn","zoomOut","panR","panL","tiltUp","tiltDown","drift","ramp","punch","dolly3d","roll"]
LAYS = ["full","split2","split3","grid4","frame"]; CAPS = ["karaoke","box","slam","emph","stack","typeon","note","rambu"]
SH = P["shots"]; ins = [s.get("in","cut") for s in SH[1:]]; mv = [s.get("move") for s in SH]; lay = [s.get("layout","full") for s in SH]
for s in SH:
    if s.get("in","cut") not in TRANS: err.append(f"{s['src']}: transisi '{s.get('in')}' tidak dikenal ({', '.join(TRANS)})")
    if s.get("move") not in MOVES: err.append(f"{s['src']}: gerak '{s.get('move')}' tidak dikenal")
    if s.get("layout","full") not in LAYS: err.append(f"{s['src']}: layout '{s.get('layout')}' tidak dikenal")
    need = {"split2":1,"split3":2,"grid4":3}.get(s.get("layout","full"),0)
    if len(s.get("extra",[])) != need: err.append(f"{s['src']}: layout {s.get('layout')} butuh {need} foto di 'extra'")
    if s.get("punch") and s.get("move") != "punch": warn.append(f"{s['src']}: 'punch' diisi tapi gerak bukan punch")
fam = lambda x: "whip" if x.startswith("whip") else x
if len({fam(x) for x in ins if x != "cut"}) < 6: err.append(f"jenis transisi cuma {len({fam(x) for x in ins if x!='cut'})} (whip dihitung 1) -> minimal 6 jenis")
if ins.count("cut") > 0.3 * len(ins): err.append(f"potong keras {ins.count('cut')}/{len(ins)} -> maksimal 30%")
for k in range(1, len(ins)):
    if fam(ins[k]) == fam(ins[k-1]) and ins[k] != "cut": err.append(f"transisi sama berurutan: {ins[k]} (shot {k+1}-{k+2})")
for k in range(2, len(ins)):
    if ins[k] == ins[k-2] and ins[k] != "cut": warn.append(f"transisi {ins[k]} berulang dengan jarak 1 shot (shot {k+2})")
if len(set(mv)) < 7: err.append(f"jenis gerak kamera cuma {len(set(mv))} -> minimal 7")
for k in range(1, len(mv)):
    if mv[k] == mv[k-1]: err.append(f"gerak sama berurutan: {mv[k]} (shot {k}-{k+1})")
nf = [x for x in lay if x != "full"]
if len(nf) < 2 or len(set(nf)) < 2: err.append("minimal 2 shot bertata letak non-full (split2/split3/grid4/frame) dengan 2 jenis berbeda")
if SH[0].get("move") not in ("ramp","punch","roll","dolly3d"): err.append("shot pertama harus bergerak tegas sejak frame 1 (ramp/punch/roll/dolly3d) — hook")
cap = {c["line"]: c["style"] for c in P.get("captions", [])}
if len(cap) != len(lines): err.append(f"captions harus diisi untuk semua {len(lines)} baris (gaya: {', '.join(CAPS)})")
cs = [cap.get(i+1) for i in range(len(lines))]
for i, c_ in enumerate(cs, 1):
    if c_ and c_ not in CAPS: err.append(f"gaya caption baris {i} '{c_}' tidak dikenal")
if len(set(cs)) < 4: err.append(f"gaya caption cuma {len(set(cs))} -> minimal 4")
if set(cs) >= set(CAPS): err.append("semua gaya caption dipakai -> video berikutnya tidak bisa lolos aturan himpunan; sisakan minimal 2 gaya")
for i in range(1, len(cs)):
    if cs[i] == cs[i-1]: err.append(f"gaya caption sama di baris {i} dan {i+1} ({cs[i]})")
if cs.count("karaoke") > 2: err.append("karaoke (gaya lama) maksimal 2 baris")
if len(P.get("hits", [])) < 2: err.append("minimal 2 hentakan di kata penting ('hits': pulse/flash/shake/zoom)")
if not P.get("emph"): warn.append("'emph' kosong -> gaya emph/slam tidak punya kata aksen")
look = P.get("look", {})
if not P.get("music") and not P.get("musicOff"): err.append("tanpa musik latar -> isi 'music': {file: 'musik/<nama>.mp3'} dari ~/sfx (cari/unduh CC0 baru kalau perlu) atau musicOff: true bila pemilik minta")
if not P.get("cta"): warn.append("'cta' kosong -> pin lokasi brand tidak muncul di kalimat ajakan")
if not look.get("name"): err.append("look.name kosong (nama gaya video ini, dicatat di riwayat)")
# beda dari video sebelumnya (references/plan/*.json, terbaru = urutan nama terakhir)
prev = sorted(glob.glob(os.path.join(SK, "references/plan/*.json")))
mine = os.path.abspath("plan.json")
prev = [f for f in prev if json.load(open(f)).get("nama") != P.get("nama")]
if prev:
    L_ = json.load(open(prev[-1])); nm = os.path.basename(prev[-1])
    for key, cur in (("titleStyle", P.get("titleStyle","type")), ("priceStyle", P.get("priceStyle","card"))):
        if L_.get(key, {"titleStyle":"type","priceStyle":"card"}[key]) == cur: err.append(f"{key} '{cur}' sama dengan video sebelumnya ({nm}) -> pilih yang lain")
    # identitas visual (pemilik 2026-11-24: "kok style visualnya sama dengan yang jambuluwuk?" — himpunan gaya caption sama, cuma diacak + huruf sama)
    fnt = look.get("font", "montserrat")
    if fnt not in ("montserrat", "anton", "archivo", "fraunces"): err.append("look.font harus montserrat/anton/archivo/fraunces")
    for f in prev[-2:]:
        if json.load(open(f)).get("look", {}).get("font", "montserrat") == fnt: err.append(f"look.font '{fnt}' sama dengan {os.path.basename(f)} -> huruf utama harus beda dari 2 video terakhir")
    for f in prev[-3:]:
        oset = {c["style"] for c in json.load(open(f)).get("captions", [])}
        if oset and set(cs) <= oset: err.append(f"himpunan gaya caption {sorted(set(cs))} sudah semua dipakai {os.path.basename(f)} (cuma diacak) -> pakai gaya lain / kurangi yang sama")
    # warna aksen = warna brand akun (pemilik 2026-11-24), jadi boleh sama antar video
    if L_.get("look", {}).get("grade") == look.get("grade"): err.append(f"grade warna sama dengan {nm} -> pilih none/warm/cool/punchy/film yang lain")
    for f in prev:
        O = json.load(open(f)); oi = [s.get("in","cut") for s in O.get("shots",[])[1:]]
        same = sum(1 for a_, b_ in zip(ins, oi) if a_ == b_) / max(1, len(ins))
        if same > 0.35: err.append(f"urutan transisi {same:.0%} sama dengan {os.path.basename(f)} -> acak ulang")
        oc = [c["style"] for c in sorted(O.get("captions", []), key=lambda c: c["line"])]
        if oc and sum(1 for a_, b_ in zip(cs, oc) if a_ == b_) / len(cs) > 0.4: err.append(f"urutan gaya caption mirip {os.path.basename(f)}")
        if O.get("shots") and O["shots"][0].get("move") == SH[0].get("move") and (O["shots"][1].get("in","cut") == SH[1].get("in","cut")): err.append(f"pembuka (gerak shot 1 + transisi ke shot 2) sama dengan {os.path.basename(f)}")
# transisi harus muat di shot (setelah vo.mjs)
TRD = {"cut":(0,0),"flash":(.04,.14),"dip":(.1,.1),"leak":(.25,.35),"zoom":(.18,.2),"spin":(.15,.17),"whipL":(.12,.13),"whipR":(.12,.13),"whipU":(.12,.13),"whipD":(.12,.13),"push":(0,.32),"drop":(0,.5),"iris":(0,.42),"slice":(0,.42),"glitch":(.07,.1)}
if os.path.exists("src/words.json"):
    W_ = json.load(open("src/words.json"))
    if len(W_["lines"]) == len(lines):
        def st_(s):
            L = W_["lines"][s["line"]-1]
            return 0 if (s["line"] == 1 and not s.get("word")) else next((w["start"] for w in L["words"] if w["show"] == s.get("word")), L["start"])
        T_ = [st_(s) for s in SH] + [W_["total"]]
        for k, s in enumerate(SH):
            pre = TRD.get(SH[k+1].get("in","cut"), (0,0))[0] if k+1 < len(SH) else 0
            post = TRD.get(s.get("in","cut"), (0,0))[1]
            if pre + post > 0.6 * (T_[k+1] - T_[k]): err.append(f"shot {k+1} {s['src']} terlalu pendek ({T_[k+1]-T_[k]:.2f} s) untuk transisinya")
            if s.get("layout") in ("split3","grid4") and T_[k+1] - T_[k] < 1.6: err.append(f"shot {k+1} {s['layout']} butuh ≥1,6 s agar semua foto terbaca")
        allw = {w["show"] for L in W_["lines"] for w in L["words"]}
        for h in P.get("hits", []):
            if h["word"] not in [w["show"] for w in W_["lines"][h["line"]-1]["words"]]: err.append(f"hit '{h['word']}' tidak ada di baris {h['line']}")
        for e in P.get("emph", []):
            if e not in allw: warn.append(f"emph '{e}' tidak muncul di naskah")
# 4. nama penginapan (dipakai untuk nama file MP4 — aturan pemilik)
if not P.get("nama", "").strip(): err.append('plan.json "nama" kosong -> isi nama penginapan persis seperti di Google Maps (jadi nama file .mp4)')
# 5. judul & kartu
if P.get("titleStyle", "type") not in ("type", "stamp", "mask", "slam", "note"): err.append("titleStyle harus type/stamp/mask/slam/note")
if P.get("priceStyle", "card") not in ("card", "count", "sticker", "ticket", "struk"): err.append("priceStyle harus card/count/sticker/ticket/struk")
for r in P["title"]:
    if len(r) > 19: err.append(f"baris judul '{r}' {len(r)} huruf -> menempel/keluar tepi layar (font 96); 'Bintang 4 Terjangkau' (20) sudah kena")
    elif len(r) > 16: warn.append(f"baris judul '{r}' {len(r)} huruf -> cek di out/cek-shot-z.jpg apakah ada jarak dari tepi")
c = P["card"]
if len(c["name"]) > 18: warn.append("nama kamar di kartu terlalu panjang")
if not re.fullmatch(r"\d{1,3}(\.\d{3})+", c["price"]): err.append("harga kartu harus format 123.456 dan dari sumber nyata (Google Maps/OTA), catat sumbernya")
# naskah lisan (pemilik 2026-11-24): partikel obrolan, tanpa daftar panjang, tanpa fasilitas umum sebagai keunggulan
PART = re.compile(r"\b(kamu|aja|tuh|banget|kok|sih|deh|nih|ya|lho|dong|kan)\b")
np_ = sum(1 for l in lines if PART.search(l.lower()))
if np_ < 4: err.append(f"naskah kaku: cuma {np_} baris berbahasa obrolan (kamu/aja/tuh/banget/kok/sih/deh/nih/ya) -> minimal 4, tulis seperti ngomong ke teman")
for i, l in enumerate(lines, 1):
    if l.count(",") >= 4: err.append(f"baris {i} berupa daftar ({l.count(',')} koma) -> TTS membacanya datar; pecah jadi kalimat lisan")
    if re.search(r"\b(parkir|parkiran|wi-?fi|internet|ac|tv|handuk|kamar mandi)\b", l.lower()): err.append(f"baris {i} menjual fasilitas yang pasti ada di semua penginapan ('{l}') -> ganti dengan keunggulan yang benar-benar beda")
# pin lokasi SELALU di kiri (pemilik 2026-11-25: "pin lokasi harusnya selalu dikiri"); yang menyesuaikan = caption, bukan pin
if P.get("cta"):
    if "x" in P["cta"]: err.append("cta.x diisi -> pin lokasi selalu di kiri (aturan pemilik); hapus cta.x, geser/ganti caption baris itu")
    if cap.get(P["cta"]["line"]) == "stack": err.append("caption baris CTA bergaya stack (rata kiri) menabrak pin di kiri -> pakai gaya tengah (box/emph/karaoke/note/typeon)")
# tier harga (SKILL.md langkah 1 & 4): penginapan mahal ditekankan ke pengalaman/fasilitas, bukan harga
tier = P.get("tier")
if tier not in ("murah", "sedang", "mahal"): err.append('plan.json "tier" harus murah/sedang/mahal (jalankan scripts/harga-kota.js)')
elif tier == "mahal":
    n = len(lines)
    if c["from"][0] <= n * 2 // 3 - 1: err.append(f"tier mahal: kartu harga di baris {c['from'][0]} -> pindah ke sepertiga akhir (baris >= {n * 2 // 3})")
    if re.search(r"\d|ribu|juta", " ".join(P["title"]).lower()): err.append("tier mahal: judul tanpa angka/harga -> tonjolkan pengalaman")
    if re.search(r"ribu|juta|harga", " ".join(lines[:2]).lower()): err.append("tier mahal: harga jangan disebut di baris 1-2")
    if re.search(r"\b(murah|hemat|terjangkau)\b", txt): err.append("tier mahal: jangan pakai kata murah/hemat/terjangkau")
elif tier == "sedang" and c["from"][0] < 2: warn.append("tier sedang: harga di baris 1 -> lebih kuat bila dibuka nilai/fasilitas dulu")
print("\n".join(["SALAH  " + e for e in err] + ["PERINGATAN " + w for w in warn]) or "bersih")
sys.exit(1 if err else 0)
