// node cek.mjs  — PEMERIKSAAN VISUAL SEBELUM RENDER PENUH
// Tiap shot difoto 3x (a/b/c) + 2 frame di tiap transisi (t1/t2) + saat tata letak masuk (l) + crash zoom (p) + hentakan (92-hit).
// Tiap shot difoto 3x (awal / tengah / akhir gerak kamera, karena pan/zoom memperlihatkan bagian foto yang berbeda),
// plus judul selesai diketik dan kartu harga. Hasil: out/cek/*.jpg lalu digabung jadi out/cek-shot.jpg (1 baris = 1 shot)
// Wajib DIBUKA dan diperiksa dengan daftar periksa di SKILL.md sebelum `node render.mjs`.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const W = JSON.parse(fs.readFileSync("src/words.json", "utf8"));
const C = JSON.parse(fs.readFileSync("src/config.json", "utf8"));
const at = (line, show) => { const L = W.lines[line - 1]; if (!show) return L.start; const w = L.words.find((x) => x.show === show); if (!w) throw new Error(`kata ${show} tidak ada di baris ${line}`); return w.start; };
const starts = C.shots.map((s) => (s.line === 1 && !s.word ? 0 : at(s.line, s.word)));
const jobs = [];
C.shots.forEach((s, i) => {
  const a = starts[i], b = starts[i + 1] ?? W.total, d = b - a;
  if (d < 0.8) console.log(`PERINGATAN shot ${i + 1} ${s.src} cuma ${d.toFixed(2)} s (terlalu cepat)`);
  if (d > 4.5) console.log(`PERINGATAN shot ${i + 1} ${s.src} ${d.toFixed(2)} s (terlalu lama untuk satu foto)`);
  const n = String(i + 1).padStart(2, "0");
  [["a", a + 0.12], ["b", a + d / 2], ["c", b - 0.12]].forEach(([k, t]) => jobs.push({ name: `${n}${k}-${s.src.replace(".jpg", "")}-L${s.line}${s.word ? "-" + s.word : ""}-${t.toFixed(1)}s`, t }));
});
// transisi: frame tengah bagian keluar & masuk (pemilik: transisi harus dicek, bukan cuma shot)
const TRD = { cut: [0, 0], flash: [0.04, 0.14], dip: [0.1, 0.1], leak: [0.25, 0.35], zoom: [0.18, 0.2], spin: [0.15, 0.17], whipL: [0.12, 0.13], whipR: [0.12, 0.13], whipU: [0.12, 0.13], whipD: [0.12, 0.13], push: [0, 0.32], drop: [0, 0.5], iris: [0, 0.42], slice: [0, 0.42], glitch: [0.07, 0.1] };
C.shots.forEach((s, i) => {
  const n = String(i + 1).padStart(2, "0"), T = starts[i], [pre, post] = TRD[s.in || "cut"] || [0, 0];
  if (i > 0 && pre + post > 0) [["t1", T - pre * 0.5], ["t2", T + post * 0.5]].forEach(([k, t]) => jobs.push({ name: `${n}${k}-${s.in}-${t.toFixed(2)}s`, t }));
  if ((s.layout || "full") !== "full") jobs.push({ name: `${n}l-${s.layout}-masuk-${(T + 0.25).toFixed(2)}s`, t: T + 0.25 });
  if (s.move === "punch" && s.punch) { const tp = at(s.punch[0], s.punch[1]); jobs.push({ name: `${n}p-punch-${(tp + 0.15).toFixed(2)}s`, t: tp + 0.15 }); }
});
(C.hits || []).forEach((h, k) => { const t = at(h.line, h.word) + 0.05; jobs.push({ name: `92-hit${k}-${h.fx}-${h.word}-${t.toFixed(1)}s`, t }); });
// caption: tiap potongan difoto saat kata terakhirnya baru muncul (kata paling banyak di layar) -> cek tidak ada yang terpotong/keluar tepi
{ const st = {}; (C.captions || []).forEach((c) => (st[c.line] = c.style)); let k = 0;
  W.lines.forEach((L) => { const ws = L.words.filter((w) => w.show); const n = st[L.line] === "slam" ? 1 : 3;
    for (let i = 0; i < ws.length; i += n) { const last = ws[Math.min(ws.length - 1, i + n - 1)]; jobs.push({ name: `c${String(k++).padStart(3, "0")}-L${L.line}-${last.show}-${(last.start + 0.12).toFixed(2)}s`, t: last.start + 0.12 }); } }); }
const t1 = W.lines[0].end; jobs.push({ name: `90-judul-selesai-${t1.toFixed(1)}s`, t: Math.min(t1, (C.title.join("").length) / 26 + 0.2) });
const cf = at(C.card.from[0], C.card.from[1]); jobs.push({ name: `91-kartu-${(cf + 0.6).toFixed(1)}s`, t: cf + 0.6 });
const browserExecutable = (() => { // Chrome dari env REMOTION_CHROME atau ~/.config/tiktok-go/config.json "chrome"; kalau kosong Remotion mengunduh sendiri
  if (process.env.REMOTION_CHROME) return process.env.REMOTION_CHROME;
  try { const c = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/tiktok-go/config.json"), "utf8")).chrome; if (c && fs.existsSync(c)) return c; } catch {}
  return undefined;
})();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const comp = await selectComposition({ serveUrl, id: "Promo", browserExecutable });
fs.mkdirSync("out", { recursive: true }); fs.rmSync("out/cek", { recursive: true, force: true }); fs.readdirSync("out").filter((f) => f.startsWith("cek-shot-")).forEach((f) => fs.rmSync(`out/${f}`)); // lembar lama bisa menyesatkan
fs.mkdirSync("out/cek", { recursive: true });
for (const j of jobs) await renderStill({ composition: comp, serveUrl, frame: Math.round(j.t * 30), output: `out/cek/${j.name}.jpg`, imageFormat: "jpeg", jpegQuality: 85, scale: 0.4, browserExecutable });
const tile = path.join(path.dirname(fs.realpathSync(process.argv[1])), "..", "scripts", "tile.py");
const tilePy = fs.existsSync(tile) ? tile : path.join(process.env.HOME, ".agents/skills/tiktok-go/scripts/tile.py");
// lembar per 8 shot agar tetap terbaca
const files = fs.readdirSync("out/cek").sort(); const groups = {};
files.forEach((f) => { const g = f.startsWith("9") ? "z" : f.startsWith("c") ? "cap" + Math.floor(parseInt(f.slice(1)) / 24) : String(Math.floor((parseInt(f) - 1) / 6)); (groups[g] ||= []).push(f); });
for (const [g, fs_] of Object.entries(groups)) {
  const dir = `out/cek/_${g}`; fs.mkdirSync(dir, { recursive: true }); fs_.forEach((f) => fs.copyFileSync(`out/cek/${f}`, `${dir}/${f}`));
  execFileSync("uv", ["run", "-q", "--with", "pillow", "python", "-I", tilePy, dir, `out/cek-shot-${g}.jpg`, "3"], { stdio: "inherit" });
}
console.log("Buka SEMUA out/cek-shot-*.jpg dan periksa dengan daftar periksa di SKILL.md sebelum render.");
