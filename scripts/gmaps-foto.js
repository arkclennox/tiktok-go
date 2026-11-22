// Jalankan di tab Google Maps (built-in browser, javascript_tool) SETELAH membuka tempatnya dan klik "See photos"/"Foto".
// Menggulir galeri dan mengumpulkan URL foto lh3. Hasil: window.__U (array). Lalu jalankan:  'URLS\n'+window.__U.join('\n')
// (kalau terlalu panjang, hasil disimpan ke file tool-results -> ambil dengan grep -oE 'https://lh3\.googleusercontent\.com/[A-Za-z-]+/[A-Za-z0-9_-]+')
await new Promise(r => setTimeout(r, 3000));
const set = new Set();
const grab = () => document.querySelectorAll('*').forEach(e => {
  const s = ((e.style && e.style.backgroundImage) || '') + ' ' + (e.src || '');
  const ms = s.match(/https:\/\/lh3\.googleusercontent\.com\/(gps-cs-s|gps-proxy|grass-cs|p)\/[^"')\s=]+/g);
  if (ms) ms.forEach(u => set.add(u));
});
const sc = [...document.querySelectorAll('div')].filter(d => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY != 'visible');
for (let i = 0; i < 40; i++) { grab(); sc.forEach(d => d.scrollBy(0, 2500)); await new Promise(r => setTimeout(r, 700)); }
grab(); window.__U = [...set]; set.size
