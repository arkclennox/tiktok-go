// Sebaran harga penginapan satu kota dari Google Maps (built-in browser, javascript_tool).
// Buka dulu: https://www.google.com/maps/search/hotel+di+<Kota>/?hl=id  lalu jalankan isi file ini.
// Hasil: jumlah, p25, median, p75 (ribu rupiah) -> dipakai menentukan "tier" harga di plan.json (lihat SKILL.md langkah 4).
const feed = document.querySelector('div[role="feed"]');
for (let i = 0; i < 12; i++) { feed.scrollTop = feed.scrollHeight; await new Promise((r) => setTimeout(r, 1500)); }
const seen = {};
feed.querySelectorAll('div[role="article"]').forEach((a) => {
  const t = a.innerText, n = t.split("\n")[0], m = t.match(/Rp\s?([\d.,]+)\s?(rb|jt)/);
  if (m) seen[n] = m[2] === "jt" ? parseFloat(m[1].replace(",", ".")) * 1000 : parseInt(m[1].replace(".", ""));
});
const v = Object.values(seen).sort((a, b) => a - b), q = (p) => v[Math.floor(p * (v.length - 1))];
JSON.stringify({ n: v.length, p25: q(0.25), median: q(0.5), p75: q(0.75), atas500: v.filter((x) => x > 500).length });
