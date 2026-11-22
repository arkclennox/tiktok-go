#!/bin/bash
# unduh.sh <urls.txt> <folder>  — unduh semua foto RESOLUSI ASLI (=s0) jadi gm_001.jpg ... + ukuran.txt
# (dulu =w2000-h2000 -> foto mendatar diperbesar 3,4x dan buram. Jangan dibatasi lagi.)
set -e; U="$1"; D="$2"; mkdir -p "$D"; cp "$U" "$D/urls.txt" 2>/dev/null || true; cd "$D"
awk '{printf "%s=s0 gm_%03d.jpg\n",$0,NR}' urls.txt | xargs -P 8 -n 2 sh -c 'curl -s -f "$0" -o "$1" || echo "gagal $1"'
for f in gm_*.jpg; do sips -g pixelWidth -g pixelHeight "$f" 2>/dev/null | awk -v f=$f 'NR==2{w=$2}NR==3{print f,w,$2}'; done > ukuran.txt
echo "$(ls gm_*.jpg | wc -l) foto, $(du -sh . | cut -f1)"
