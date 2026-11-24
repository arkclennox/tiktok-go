#!/bin/bash
# setup.sh — sekali per perangkat: pasang Remotion (runtime/) dan font Montserrat (SIL OFL 1.1, dari repo resmi google/fonts)
set -e
K="$(cd "$(dirname "$0")/.." && pwd)"
(cd "$K/runtime" && npm install --no-audit --no-fund --loglevel=error)
mkdir -p "$K/template/public/fonts"
F="$K/template/public/fonts/Montserrat.ttf"
[ -f "$F" ] || curl -fsSL "https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf" -o "$F"
F2="$K/template/public/fonts/Caveat.ttf"   # tulisan tangan untuk gaya note/ticket (SIL OFL 1.1)
[ -f "$F2" ] || curl -fsSL "https://github.com/google/fonts/raw/main/ofl/caveat/Caveat%5Bwght%5D.ttf" -o "$F2"
F3="$K/template/public/fonts/SpaceMono.ttf"  # huruf mesin kasir untuk harga "struk" (SIL OFL 1.1)
[ -f "$F3" ] || curl -fsSL "https://github.com/google/fonts/raw/main/ofl/spacemono/SpaceMono-Bold.ttf" -o "$F3"
mkdir -p "$HOME/.config/tiktok-go"
[ -f "$HOME/.config/tiktok-go/config.json" ] || cat > "$HOME/.config/tiktok-go/config.json" <<'JSON'
{
  "envFiles": [],
  "chrome": "",
  "whisperBin": "whisper-cli",
  "whisperModel": ""
}
JSON
# huruf utama pilihan look.font (SIL OFL 1.1, google/fonts)
G=https://github.com/google/fonts/raw/main/ofl
[ -f "$K/template/public/fonts/Anton.ttf" ] || curl -fsSL "$G/anton/Anton-Regular.ttf" -o "$K/template/public/fonts/Anton.ttf"
[ -f "$K/template/public/fonts/ArchivoBlack.ttf" ] || curl -fsSL "$G/archivoblack/ArchivoBlack-Regular.ttf" -o "$K/template/public/fonts/ArchivoBlack.ttf"
[ -f "$K/template/public/fonts/Fraunces.ttf" ] || curl -fsSL "$G/fraunces/Fraunces%5BSOFT,WONK,opsz,wght%5D.ttf" -o "$K/template/public/fonts/Fraunces.ttf"
command -v ffmpeg >/dev/null || echo "PERLU: ffmpeg (brew install ffmpeg / apt install ffmpeg)"
command -v uv >/dev/null || echo "PERLU: uv (https://docs.astral.sh/uv/) untuk lint.py/prep.py"
echo "siap. Atur kunci & whisper di ~/.config/tiktok-go/config.json (lihat references/tts.md)"
