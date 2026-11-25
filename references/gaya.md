# Bahasa edit v2 — kosakata gaya & sumbernya

Pemilik (2026-11-23): "caption, efek, dan transisi terlalu monoton… cari inspirasi dari sumber luar yang lebih akurat, bukan dari ingatan."
Semua yang ada di sini dipilih **per shot / per baris** di `plan.json`; `lint.py` memaksa variasi (lihat bawah).
Kalau menambah gaya baru: cari dulu acuan luar (artikel 2025–2026, blok hyperframes-registry, video viral), catat sumbernya di sini.

## Acuan luar yang dipakai

- Tren edit TikTok 2026: speed ramp / velocity, beat-sync, transisi pendek (<0,3 s), whip pan, match cut, frame pertama harus bergerak —
  [opus.pro](https://www.opus.pro/research/video-editing-guide-tiktok), [getmediatools](https://getmediatools.com/blog/10-tiktok-editing-tips-viral-2026),
  [increditors](https://increditors.com/tiktok-ad-video-editing-2026), [capcut trends 2026](https://www.capcut.com/help/latest-capcut-editing-trends).
- Caption kinetik kata-per-kata, kontras ukuran untuk kata penting, potongan 2–4 kata 600–900 ms, lower third statis mulai ditinggalkan —
  [makemoonshot](https://makemoonshot.co/blog/kinetic-typography-captions), [kreateflo](https://kreateflo.com/blog/which-caption-styles-increase-watch-time-on-social-platforms),
  [fontmirror](https://fontmirror.com/en/typography-trends-shaping-short-form-ai-video-content).
- Template "photo dump": transisi halus, bingkai film, kolase, kilat, cap tanggal, motion blur — [tycoonstory](https://www.tycoonstory.com/best-trending-capcut-template-collection/);
  efek 3D/parallax foto — [capcut photo edit](https://www.capcut.com/resource/tiktok-photo-edit).
- Kode & angka nyata dari blok **hyperframes-registry** (`npx hyperframes add <nama>`): `camera-shake` (profil goyang terukur Cinemachine),
  `transitions-other` (flash cut 0,03/0,1 s, gravity drop, morph circle), `transitions-light` (light leak), `whip-pan`, `cinematic-zoom`,
  `freeze-frame-dressing` (kilat 0,06/0,24 s + kertas), `beat-accent` (pulsa skala 1+0,18·i, kilat radial), `caption-kinetic-slam`,
  `caption-editorial-emphasis`, `caption-highlight`, `caption-clip-wipe`, `bottom-up-letters`, `mk-progress-stat`.
- Video acuan dibedah frame per frame (Orbi City Batumi 166k, Avani+ Samui 420k, Grand Hyatt Dubai 174k): potong cepat 0,7–1,5 s, dip-to-black,
  caption 2 kata kuning/putih, top-down berputar, bawah air.

- Gaya "foto film berdua" (2026-11-24): grade film + grain untuk video pasangan; caption utama tetap sans tebal, tulisan tangan hanya aksen untuk baris emosional —
  [blitzcut caption trends 2026](https://blitzcutai.com/blog/tiktok-caption-trends-2026), [amraandelma text overlay](https://www.amraandelma.com/text-overlay-styles-influencers-are-using/),
  [filmora couple filters](https://filmora.wondershare.com/video-creative-tips/couple-video-filters-for-tiktok-trendy-pop-colors.html). Font Caveat (SIL OFL, google/fonts).

- Gaya "struk kasir" (2026-11-24): rincian fasilitas dicetak baris demi baris lalu TOTAL menghitung naik + cap — untuk video hemat/rincian harga. Font Space Mono (SIL OFL, google/fonts).

## Kosakata (plan.json)

| kunci | pilihan |
|---|---|
| `shots[].in` (transisi masuk) | `cut` `flash` `dip` `leak` `zoom` `spin` `whipL/R/U/D` `push` `drop` `iris` `slice` `glitch` |
| `shots[].move` | `zoomIn` `zoomOut` `panR` `panL` `tiltUp` `tiltDown` `drift` `ramp` (speed ramp) `punch` (crash zoom di `punch:[baris,"KATA"]`) `dolly3d` `roll` |
| `shots[].layout` | `full`, `split2` (+1 foto di `extra`), `split3` (+2), `grid4` (+3), `frame` (polaroid jatuh + kilat, `label` opsional) |
| `captions[]` per baris | `karaoke` (lama) `box` `slam` `emph` `stack` `typeon` `note` (tulisan tangan Caveat, kata aktif warna brand + coretan); `y` opsional = posisi tegak (geser kalau menutupi papan nama) |
| `emph` | kata TAMPIL yang dibesarkan/diwarnai aksen (gaya emph & slam) |
| `hits[]` | `{line, word, fx}` dengan fx `pulse` `flash` `shake` `zoom` — hentakan di kata penting |
| `titleStyle` | `type` (lama) `stamp` `mask` `slam` `note` (catatan tangan + garis bawah digambar); `titleY` = posisi tegak judul |
| `priceStyle` | `card` (kartu TikTok) `count` (angka menghitung naik) `sticker` `ticket` (tiket kertas + potongan brand, `card.stub`) `struk` (struk kasir tercetak dari celah printer, font Space Mono, `card.items` [[nama, nilai]…], `receiptNote`, `priceNote`, cap `card.stamp`; cocok tier murah) |
| `shots[].z` / `oy` | zoom dasar & geser tegak (px) satu shot penuh; prep.py ikut memperbesar resolusi |
| `look` | `{name, font: montserrat/anton/archivo/fraunces, grade: none/warm/cool/punchy/film, grain 0–0.1, vignette 0–0.5, accent "#hex", shake ≈0.18}` — `font` = huruf utama judul/caption/harga (anton tinggi ramping, archivo lebar tebal, fraunces serif untuk tier mahal) |
| `music` | `{file: "musik/<nama>.mp3", volume ≈0.13}` dari `~/sfx/musik` (CC0); prep.py menggeser titik mulai agar ketukan jatuh di potongan shot (beat-sync, `hyperframes beats`). Wajib, kecuali `musicOff` |
| `cta` | `{line, word}` — pin lokasi bergaya logo brand memantul + panah ke tag lokasi, SELALU di kiri (jangan isi x); caption baris itu jangan `stack` |
| `sfx` / `sfxOff` | ganti berkas efek suara (kunci: whoosh swish shutter thud pop glitch shimmer click coin) atau matikan |

Efek suara otomatis mengikuti transisi/hentakan, dari `~/sfx` (CC0, `sfxDir` di `~/.config/tiktok-go/config.json`).

## Warna brand

Aksen, kotak caption, pita, pil harga, stiker dan pin lokasi memakai gradasi brand akun dari `~/.config/tiktok-go/config.json`:
`"brand": {"name", "light", "mid", "deep", "logo"}` (lokal, tidak di repo). Tanpa brand -> `look.accent`.

## Caption tidak boleh terpotong

Ukuran huruf diukur dengan font asli dan dikecilkan sampai muat 940 px (`fit()`); kata selalu muncul utuh; tidak ada efek sapu/clip pada teks.

## Aturan anti-monoton (lint.py — SALAH = wajib diperbaiki)

- ≥6 jenis transisi (whip dihitung 1), potong keras ≤30%, tidak ada transisi sama berurutan.
- ≥7 jenis gerak kamera, tidak ada gerak sama berurutan; shot 1 harus `ramp`/`punch`/`roll`/`dolly3d` (frame pertama bergerak).
- ≥2 shot non-full dengan ≥2 jenis tata letak; split3/grid4 ≥1,6 s.
- Caption diisi semua baris, ≥4 gaya, tidak ada gaya sama berurutan, karaoke ≤2 baris; ≥2 `hits`.
- Identitas visual: `look.font` beda dari 2 video terakhir; himpunan gaya caption tidak boleh sama/bagian dari salah satu 3 video terakhir (mengacak urutan saja = sama); grade beda dari video sebelumnya.
- Beda dari video sebelumnya (`references/plan/*.json`): `titleStyle`, `priceStyle`; urutan transisi ≤35% sama;
  urutan gaya caption ≤40% sama; pembuka (gerak shot 1 + transisi shot 2) tidak sama.
- Transisi harus muat (pre+post ≤60% durasi shot).

`cek.mjs` merender juga 2 frame tiap transisi (t1/t2), saat tata letak masuk (l), crash zoom (p) dan tiap hentakan (92-hit). Semua wajib dilihat.
