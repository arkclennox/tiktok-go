#!/bin/bash
# setup.sh — sekali per perangkat: pasang Remotion (runtime/) dan font Montserrat (SIL OFL 1.1, dari repo resmi google/fonts)
set -e
K="$(cd "$(dirname "$0")/.." && pwd)"
(cd "$K/runtime" && npm install --no-audit --no-fund --loglevel=error)
mkdir -p "$K/template/public/fonts"
F="$K/template/public/fonts/Montserrat.ttf"
[ -f "$F" ] || curl -fsSL "https://github.com/google/fonts/raw/main/ofl/montserrat/Montserrat%5Bwght%5D.ttf" -o "$F"
mkdir -p "$HOME/.config/tiktok-go"
[ -f "$HOME/.config/tiktok-go/config.json" ] || cat > "$HOME/.config/tiktok-go/config.json" <<'JSON'
{
  "envFiles": [],
  "chrome": "",
  "whisperBin": "whisper-cli",
  "whisperModel": ""
}
JSON
command -v ffmpeg >/dev/null || echo "PERLU: ffmpeg (brew install ffmpeg / apt install ffmpeg)"
command -v uv >/dev/null || echo "PERLU: uv (https://docs.astral.sh/uv/) untuk lint.py/prep.py"
echo "siap. Atur kunci & whisper di ~/.config/tiktok-go/config.json (lihat references/tts.md)"
