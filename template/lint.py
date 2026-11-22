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
srcs = [s["src"] for s in P["shots"]]
for s in set(srcs):
    if srcs.count(s) > 1: err.append(f"foto {s} dipakai {srcs.count(s)}x")
bahan = P.get("bahan", "../bahan-gmaps"); uk = {}
if os.path.exists(os.path.join(bahan, "ukuran.txt")):
    for l in open(os.path.join(bahan, "ukuran.txt")):
        p = l.split()
        if len(p) == 3: uk[p[0]] = (int(p[1]), int(p[2]))
for s in P["shots"]:
    if not os.path.exists(os.path.join(bahan, s["src"])): err.append(f"{s['src']} tidak ada di {bahan}"); continue
    w, h = uk.get(s["src"], (0, 0))
    if w and max(1188 / w, 2112 / h) > 1.02 and max(1188 / h, 2112 / w) > 1.02: err.append(f"{s['src']} {w}x{h} terlalu kecil -> akan diperbesar dan buram, ganti")
    if not 1 <= s["line"] <= len(lines): err.append(f"{s['src']} baris {s['line']} di luar naskah")
for a, b in zip(P["shots"], P["shots"][1:]):
    if a["move"] == b["move"]: warn.append(f"{a['src']} dan {b['src']} gerak sama berurutan ({a['move']})")
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
# 4. nama penginapan (dipakai untuk nama file MP4 — aturan pemilik)
if not P.get("nama", "").strip(): err.append('plan.json "nama" kosong -> isi nama penginapan persis seperti di Google Maps (jadi nama file .mp4)')
# 5. judul & kartu
for r in P["title"]:
    if len(r) > 19: err.append(f"baris judul '{r}' {len(r)} huruf -> menempel/keluar tepi layar (font 96); 'Bintang 4 Terjangkau' (20) sudah kena")
    elif len(r) > 16: warn.append(f"baris judul '{r}' {len(r)} huruf -> cek di out/cek-shot-z.jpg apakah ada jarak dari tepi")
c = P["card"]
if len(c["name"]) > 18: warn.append("nama kamar di kartu terlalu panjang")
if not re.fullmatch(r"\d{1,3}(\.\d{3})+", c["price"]): err.append("harga kartu harus format 123.456 dan dari sumber nyata (Google Maps/OTA), catat sumbernya")
print("\n".join(["SALAH  " + e for e in err] + ["PERINGATAN " + w for w in warn]) or "bersih")
sys.exit(1 if err else 0)
