# Pelajaran (WAJIB dibaca sebelum mulai, WAJIB ditambah setelah tiap video)

Format tiap entri: `- [tanggal] [video] KESALAHAN -> ATURAN/PERBAIKAN (dicek oleh: lint.py / cek.mjs / mata)`.
Kalau sebuah pelajaran bisa dicek mesin, tambahkan juga ke `template/lint.py` (atau `cek.mjs`) — jangan hanya ditulis di sini.

## Suara & naskah
- [2026-11-21] Jetos: "booking" diucapkan "buking", dua kali diperbaiki tetap salah -> JANGAN pakai kata Inggris; pakai "pesan". Juga hindari check-in, homestay, rate, pool, breakfast (lint.py BANNED).
- [2026-11-21] Jetos: "Apartemen di Jember satu ini" terdengar aneh -> jangan "satu ini" (lint.py).
- [2026-11-21] Jetos: jeda antar kalimat diminta 0,3 detik -> `overlap: 0.3` (lint.py).
- [2026-11-21] JC: "Pesan sekarang juga di tag lokasi!" nadanya beda dari kalimat lain -> akhiri kalimat dengan titik, bukan "!" (lint.py peringatan).
- [2026-11-21] JC: naskah "terlalu monoton, terlalu mirip video pertama" (template Jetos diisi ulang) -> tiap video naskah BARU: pembuka, alur, kata, dan CTA berbeda; lint.py membandingkan dengan references/naskah/*.json (>12% 3-kata sama = SALAH).
- [2026-11-22] Trans Luxury: nama Inggris "The Trans Luxury" ditulis seperti diucapkan "De Trans Laksyuri" + replace ke THE TRANS LUXURY (pengucapan belum didengar pemilik — tanyakan).
- Nama merek/singkatan dibaca huruf: tulis seperti diucapkan ("Je Ce") dan tampilkan lewat `replace` ("je ce": "JC"). Angka ditulis huruf di naskah, tampil angka lewat `replace`.

## Gambar
- [2026-11-21] JC: "gambarnya kurang tajam" -> foto diunduh dibatasi 2000 px lalu diperbesar ~3,4x. Unduh RESOLUSI ASLI `=s0` (scripts/unduh.sh), kecilkan pas layar dengan prep.py, render JPEG q100 crf 16. Jangan pernah pakai foto yang "DIPERBESAR" (prep.py/lint.py).
- [2026-11-21] Aston: foto aslinya goyang/buram (kamera pengunggah) walau resolusinya besar -> resolusi besar ≠ tajam; zoom ke foto di cek-shot, ganti kalau lembek.
- [2026-11-21] Jetos: watermark pengunggah "OPPO A9 2020 · ©…" di pojok foto; Aston: cap tanggal "26.22.11" di pojok bawah -> periksa SEMUA pojok tiap frame a/b/c di cek-shot (gerak kamera bisa memperlihatkan pojok yang awalnya tersembunyi).
- [2026-11-21] Jetos: foto papan nama salah tempat (147 bukan penginapan itu) -> pastikan foto benar-benar tempat yang dipromosikan (nama di papan, bentuk gedung sama).
- [2026-11-21] JC: foto 036 terpotong jadi hanya dinding -> crop tegak dari foto mendatar bisa kehilangan objek; lihat frame a/b/c, objek utama harus terlihat sepanjang shot.
- [2026-11-21] Aston: foto 071 (panorama/hasil sambung) memperlihatkan papan "ASTOSTON" di akhir pan -> hindari foto panorama sambungan; baca semua tulisan di frame c.
- Hindari wajah orang yang jelas (tamu, anak-anak) sebagai fokus shot.

- [2026-11-22] Trans Luxury: foto resmi hotel (eksterior, kamar) di Google Maps cuma 1080 px -> tidak bisa dipakai layar penuh; cari foto pengunjung ≥2112 px (mendatar) / ≥1188x2112 (tegak). lint.py menolak; cek ukuran.txt saat memilih dari lembar kontak.
- [2026-11-22] Trans Luxury: foto pintu masuk yang tersedia menonjolkan mobil + pelat nomor atau logo toko di mal -> jangan dipakai; pakai foto gedung/lobi.
- [2026-11-22] Trans Luxury: gerak pan bisa berakhir di objek yang salah (065: kata "kasur" tapi frame c pintu; 144: frame c pria di cermin) -> pilih gerak yang menahan objek utama (zoomIn) dan cek frame c (cek.mjs).
- [2026-11-22] Trans Luxury: sepatu pengunjung di pojok foto lantai kaca (155) -> ganti; dua foto kolam malam berpalem berurutan (104, 061) -> terlalu mirip, ganti.

## Tata letak
- [2026-11-21] Aston: judul "Bintang 4, Harga Santai" keluar tepi, "Bintang 4 Terjangkau" menempel tepi -> tiap baris judul ≤16 huruf aman, 17–19 cek mata, ≥20 SALAH (lint.py).
- Kartu harga menutupi bagian atas layar dari kata harga sampai akhir baris 3 — shot di bawahnya harus tetap terbaca di setengah bawah.

## Kerja / mesin
- [2026-11-21] Render gagal "delayRender font timeout" padahal penyebabnya disk penuh (ENOSPC): render PNG + 260 folder sementara Remotion sisa gagal (6,7 GB). Cek `df -h` sebelum render (butuh ≥3 GB), simpan log render ke file dan baca seluruhnya, hapus `$TMPDIR/remotion-*` hanya bila tidak ada render berjalan.
- [2026-11-21] node_modules dipinjam dari proyek lain lalu folder itu hilang -> pakai `runtime/node_modules` milik skill ini.
- [2026-11-21] Folder fonts lupa disalin -> salin seluruh template (`cp -R template/. <proyek>`), jangan pilih-pilih file.
- [2026-11-21] Semua: file hasil bernama promo-jetos/promo-jc/promo-aston.mp4 -> pemilik: nama file .mp4 HARUS sesuai nama homestay/hotel. Isi `"nama"` di plan.json; render.mjs memberi nama otomatis (lint.py menolak kalau kosong).
- [2026-11-22] Trans Luxury: 7 shot cuma 0,45–0,76 s karena kata pemicu ada di ujung kalimat -> pilih kata pemicu di paruh awal kalimat; kalimat pendek (<2,5 s) cukup 1 shot. lint.py sekarang menghitung durasi shot (SALAH <0,8 s).
- [2026-11-22] Trans Luxury: out/cek-shot-3.jpg sisa putaran lama ikut terbaca -> cek.mjs sekarang menghapus lembar lama sebelum membuat yang baru.

## Gaya visual (bahasa edit v2 — lihat references/gaya.md)
- [2026-11-23] Semua video 1–4: "caption, efek, transisi terlalu monoton, kurang bervariasi"; usulan dari ingatan ditolak sebagai "terlalu baku" -> cari acuan LUAR dulu (artikel terbaru, video viral dibedah frame per frame, blok hyperframes-registry) dan catat sumbernya di gaya.md. Variasi dipaksa lint.py (≥6 transisi, ≥7 gerak, ≥4 gaya caption, ≥2 tata letak non-full, ≥2 hentakan, beda dari plan video sebelumnya di references/plan/).
- [2026-11-23] Jambuluwuk: kata "slam" panjang ("BELAKANGNYA") terpotong tepi layar -> ukuran = 1150/jumlah huruf, nowrap (Promo.tsx); cek frame slam di cek-shot.
- [2026-11-23] Jambuluwuk: caption stack/box menutupi papan nama "Jambuluwuk BATU" -> geser lewat `captions[].y` atau ganti gaya; papan nama/tulisan di foto harus terbaca utuh (cek frame a/b/c).
- [2026-11-23] Jambuluwuk: whip pan versi pertama menyisakan layar hitam di tengah transisi -> shot lama & baru harus menempel dan meluncur bersama (sudah diperbaiki); lihat frame t1/t2 tiap transisi.
- [2026-11-23] Jambuluwuk: 3 foto teratas galeri (003, 004, 005) gedung kota — bukan resort ini -> galeri Google Maps bisa berisi tempat lain; cocokkan dengan bentuk bangunan/papan nama.
- [2026-11-23] cek.mjs: `fs.mkdirSync("out/cek")` ikut tertulis di dalam komentar dan folder `out` belum ada di proyek baru -> sudah diperbaiki; kalau cek.mjs gagal ENOENT, lihat baris itu.
- [2026-11-24] Jambuluwuk: "caption mu banyak yang terpotong" — penyebab: (a) typeon mengetik per huruf lalu potongan berganti sebelum kata selesai (kalimat saling tumpang 0,3 s), (b) efek sapu/clip memperlihatkan setengah kata, (c) slam masuk dari luar layar / mulai skala 1,6, (d) ukuran huruf ditebak, bukan diukur -> SEKARANG: kata selalu tampil UTUH saat mulai diucapkan, tidak ada sapu/clip pada teks, slam tumbuh dari kecil, semua ukuran huruf diukur dengan font asli (`fit()` di Promo.tsx, lebar aman 940 px). cek.mjs membuat lembar `cek-shot-cap*.jpg` (tiap potongan caption saat kata terakhirnya muncul) — WAJIB dilihat; setelah render, buat lembar 4–8 fps area caption dari MP4 dan lihat juga.
- [2026-11-24] Jambuluwuk: warna aksen dipilih sendiri (tosca) -> pemilik: "sesuaikan dengan logo akun". Warna brand ada di `~/.config/tiktok-go/config.json` "brand" (lokal, bukan di repo); prep.py menyalinnya, semua aksen/kotak/pita/pin memakai gradasi brand.
- [2026-11-24] Jambuluwuk: "kamu bebas mengunduh semua kebutuhan… tapi malah membatasi diri" (tanpa musik, SFX seadanya) -> wajib musik latar (lint.py), cari & unduh yang kurang: musik/SFX CC0 lewat `python3 ~/sfx/tools/fs.py search "<kata>" --max 200` lalu `get <kategori> <id>`, ikon digambar SVG, foto resmi/OTA bila foto Google Maps kurang. Jangan menahan diri karena "belum ada di folder".
- [2026-11-24] Grand Malioboro: judul "note" menutupi papan nama hotel di shot 1, lalu zoom+geser (`z`/`oy`) malah memotong papan nama -> foto papan nama yang memenuhi layar jangan dipakai di bawah judul; pilih foto gedung untuk shot 1 atau atur `titleY`. Galeri juga berisi iklan usaha lain (spa) di bawah papan nama.
- [2026-11-24] Grand Malioboro: renderMedia macet "delayRender() font … not cleared" (juga di proyek lama), padahal font sudah termuat dan renderStill/cek lancar. Penyebab: delayRender di tingkat modul Root.tsx dilepas sebelum Remotion siap mencatatnya. Perbaikan: font dimuat di dalam komponen (useState(delayRender) + useEffect) — sudah di template. Kalau muncul lagi: tes `frameRange` pendek + logLevel verbose, cari baris "delayRender".
- [2026-11-24] Grand Malioboro: caption polaroid (frame) menimpa label tulisan tangan di bawah foto -> beri `captions[].y` ≈1640 untuk baris yang tampil bersama polaroid.
