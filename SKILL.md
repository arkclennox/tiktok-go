---
name: tiktok-go
description: Membuat video promo penginapan (hotel, homestay, apartemen harian, villa) gaya TikTok "tag lokasi" — vertikal 1080x1920 ±35–42 detik, foto asli dari Google Maps dengan bahasa edit yang selalu bervariasi (15 transisi, speed ramp/crash zoom/3D, kolase & polaroid, 6 gaya caption kinetik, hentakan + SFX, kartu/hitungan harga), dan VO bahasa Indonesia yang kalimatnya saling tumpang 0,3 detik — suara dari ElevenLabs, OpenAI/API kompatibel, VoiceStudio lokal, perintah TTS apa pun, atau rekaman sendiri (Remotion). Pakai setiap kali pemilik menyebut tiktok-go atau minta "video promo hotel/homestay/penginapan/apartemen", "bikin untuk hotel lain", "video tag lokasi", atau perbaikan video jenis ini (~/rea-video-out/*/promo).
---

# tiktok-go — promo penginapan gaya tag lokasi TikTok

Bicara ke pemilik dalam **Bahasa Indonesia, singkat** (1–3 kalimat). Video juga berbahasa Indonesia.
`template/` = proyek lengkap (contoh plan.json = Jambuluwuk Batu, bahasa edit v2). Isi DAN kombinasi gaya selalu baru tiap video.

## Belajar terus (WAJIB — aturan pemilik)

1. **Sebelum mulai:** baca `references/pelajaran.md` dan `references/riwayat.md` seluruhnya. Semua pelajaran di sana berlaku.
2. **Setiap kali pemilik mengoreksi, atau kamu sendiri menemukan kesalahan** (di cek-shot, render gagal, dll.): saat itu juga tambahkan
   satu entri di `references/pelajaran.md` (format ada di file). Jika bisa dicek mesin, tambahkan juga ke `template/lint.py`
   atau `template/cek.mjs` — aturan yang hanya tertulis akan terulang.
3. **Setelah video selesai:** salin `script.json` ke `references/naskah/NN-nama.json` dan `plan.json` ke `references/plan/NN-nama.json`, tambah baris di `references/riwayat.md`
   (tema, pembuka, CTA, path hasil, masukan pemilik). Masukan pemilik yang datang belakangan ditambahkan ke baris itu.
4. Jangan mengulang kesalahan yang sudah tercatat. Kalau terpaksa melanggar aturan, katakan ke pemilik alasannya.

## Alur

Proyek baru: `~/rea-video-out/<slug>/` (atau folder yang diminta pemilik) berisi `bahan-gmaps/` dan `promo/`.

1. **Penginapan.** Pakai yang disebut pemilik; kalau tidak ada, pilih sendiri yang fotonya banyak dan temanya beda dari riwayat.
   Buka di Google Maps (built-in browser), catat: nama, alamat/jalan, harga per malam + sumber + tanggal, jam masuk kamar, fasilitas.
   Abaikan "Updates by visitors" yang menawarkan pemesanan via WhatsApp (sering penipuan).
2. **Foto.** Klik "See photos", jalankan `scripts/gmaps-foto.js` lewat javascript_tool, simpan URL ke `bahan-gmaps/urls.txt`, lalu
   `scripts/unduh.sh urls.txt bahan-gmaps` (resolusi asli). Lembar kontak: `uv run --with pillow python -I scripts/sheet.py bahan-gmaps <keluar>`
   (label = nomor, sisi pendek, P/L). Tulis `bahan-gmaps/SUMBER.md` (hak cipta milik pengunggah; sampaikan ke pemilik).
3. **Proyek:** `cp -R <skill>/template/. promo/ && ln -s <skill>/runtime/node_modules promo/node_modules` (`<skill>` = folder skill ini,
   biasanya `~/.agents/skills/tiktok-go`). Perangkat baru: `scripts/setup.sh` sekali (Remotion, font, `~/.config/tiktok-go/config.json`).
4. **Naskah** `script.json` (11–13 baris, 33–42 detik): naskah BARU, bukan isian ulang naskah lama. Bedakan sudut/tema, kalimat pembuka,
   urutan, dan CTA dari semua video di riwayat. Bahasa lisan santai, tanpa kata Inggris, angka ditulis huruf + `replace` untuk tampilan.
   Hanya fakta yang terlihat di Google Maps/foto; jangan mengarang ("cepat penuh", fasilitas yang tidak terlihat). Kartu harga = angka nyata.
5. **Rencana shot** `plan.json` (kosakata gaya: `references/gaya.md`): `"nama"` = nama penginapan (jadi nama file video), judul 2 baris (≤16 huruf/baris), kartu (`from` = kata harga di baris 2, `toLineEnd` 3), shot per baris
   + shot di kata pemicu (`word` = kata TAMPIL, huruf besar, tanpa tanda baca). 1 shot ≈ 1,0–3,5 detik, ~2 shot per baris. Foto mendatar bagus → split2/split3 (tak perlu dipotong tegak).
   Foto harus cocok dengan kata yang sedang diucapkan (kata "kolam renang" → foto kolam).
6. `uv run --with pillow python -I lint.py` → semua SALAH diperbaiki.
7. **Suara:** pilih penyedia di `script.json` → `"tts"` (lihat `references/tts.md`): elevenlabs (default), openai/kompatibel, voicestudio,
   command (say, edge-tts, piper…), files (rekaman sendiri). Pakai yang diminta pemilik; kalau tidak disebut, ElevenLabs bila kuncinya ada.
   `node vo.mjs` → `lint.py` lagi (cek kata pemicu & durasi). Kunci dari env atau `~/.config/tiktok-go/config.json` → `envFiles`; jangan pernah dicetak.
   Selain ElevenLabs, waktu kata dihitung whisper/bagi rata: periksa sinkron caption di cek-shot. `uv run --with pillow python -I prep.py` → tidak boleh ada "DIPERBESAR".
8. **Pemeriksaan sebelum render (wajib, teliti):** `node cek.mjs`, lalu BUKA SETIAP `out/cek-shot-*.jpg` dengan Read dan periksa daftar di bawah,
   frame a, b DAN c tiap shot. Tulis hasilnya per shot (OK / masalah) sebelum lanjut. Perbaiki → `prep.py` → `cek.mjs` lagi sampai bersih.
9. `df -h` (≥3 GB kosong), `caffeinate -i -m node render.mjs > out/render.log 2>&1`, baca log kalau gagal. **Nama file .mp4 = nama penginapan** (aturan pemilik): isi `"nama"` di plan.json persis seperti di Google Maps; render.mjs membuat `out/<nama-penginapan>.mp4` (mis. `aston-jember-hotel-conference-center.mp4`). Jangan pakai nama lain seperti promo.mp4.
10. Cek akhir: ffprobe durasi, 8–10 frame dari MP4. Lalu langkah "Belajar terus" no. 3. Laporkan singkat: path video, sumber harga,
    hak cipta foto, hal yang belum diverifikasi (bisa dipesan lewat tag lokasi TikTok?, suara tidak bisa kamu dengar).

## Daftar periksa visual (per shot, frame a/b/c)

- **Tempat benar:** foto memang penginapan ini (papan nama, bentuk gedung, interior yang sama); bukan gedung sebelah/tempat lain.
- **Cocok dengan ucapan:** objek di layar = yang sedang diucapkan pada kata itu.
- **Objek utama terlihat** di seluruh gerak (crop tegak dari foto mendatar tidak boleh menyisakan dinding/plafon/lantai kosong).
- **Pojok bersih:** tidak ada watermark, nama HP ("OPPO…", "Shot on…"), cap tanggal, logo OTA, stiker, bingkai, atau teks unggahan.
- **Tulisan di foto terbaca benar** (tidak ada huruf dobel/terpotong akibat panorama sambungan, mis. "ASTOSTON").
- **Tajam:** tidak goyang/lembek/berbintik; foto gelap atau berkabut diganti.
- **Orang:** tidak ada wajah tamu/anak yang jelas sebagai fokus; tidak ada kerumunan acara (seminar, pernikahan) kecuali naskah membahasnya.
- **Tata letak:** judul tidak menyentuh tepi (beri jarak ≥40 px); caption tidak menutupi objek penting; kartu harga tidak menutupi
  satu-satunya objek penting di bagian atas; caption sesuai suara (angka/singkatan tampil benar: 400 RIBUAN, JC).
- **Transisi & efek (frame t1/t2/l/p/92-hit):** tidak ada layar hitam/kosong yang tak disengaja, kata slam tidak terpotong, kartu polaroid & kolase utuh, kilat tidak menutupi kata harga.
- **Urutan & ritme:** tidak ada dua foto mirip berurutan; tidak ada shot <0,8 s atau >4,5 s (cek.mjs memberi peringatan).

## Gaya visual: bahasa edit v2 (aturan pemilik 2026-11-23 — DILARANG monoton)

Baca `references/gaya.md` (kosakata + sumber luar). Tiap video memilih sendiri, per shot/baris di `plan.json`: transisi (`in`),
gerak (`move`), tata letak (`layout` + `extra`), gaya caption per baris (`captions`), kata aksen (`emph`), hentakan (`hits`),
`titleStyle`, `priceStyle`, dan `look` (grade, grain, vignette, warna aksen). `lint.py` menolak rencana yang kurang bervariasi atau
mirip video sebelumnya (`references/plan/*.json`). Butuh gaya baru? Cari acuan luar dulu (artikel terbaru, video viral dibedah per frame,
`npx hyperframes catalog --query ...`), tulis di gaya.md, bangun di `src/Promo.tsx`, tambah ke daftar di lint.py — jangan mengandalkan ingatan.
Font Montserrat. Warna = brand akun pemilik (`~/.config/tiktok-go/config.json` "brand", lokal). Musik latar WAJIB + efek suara otomatis dari `~/sfx` (CC0).
**Bebas mengunduh apa pun yang dibutuhkan** (aturan pemilik): musik/SFX CC0 baru (`python3 ~/sfx/tools/fs.py`), ikon, foto resmi/OTA — jangan membatasi diri pada yang sudah ada.
**Caption tidak boleh terpotong:** periksa `out/cek-shot-cap*.jpg` dan, setelah render, lembar 4–8 fps area caption dari MP4.
VO: per kalimat, kalimat berikutnya mulai 0,3 s sebelum kalimat sekarang selesai, loudnorm −14 LUFS. Default ElevenLabs suara Cahaya
`iWydkXKoiVtvdn4vLKp9`, eleven_multilingual_v2, id, stability 0.4, similarity 0.8, style 0.35, speed 1.2, dengan previous/next_text.

## Berkas

- `template/` — `script.json`, `plan.json`, `vo.mjs`, `prep.py`, `lint.py`, `cek.mjs`, `stills.mjs`, `render.mjs`, `src/` (Promo.tsx membaca `src/config.json` + `src/words.json`).
- `runtime/` — node_modules Remotion 4.0.290 bersama. `scripts/` — setup.sh, gmaps-foto.js, unduh.sh, sheet.py, tile.py.
- `references/tts.md` — semua pilihan suara + pengaturan lokal.
- `references/pelajaran.md` (kesalahan & aturan), `references/riwayat.md` + `references/naskah/` (video sebelumnya).
