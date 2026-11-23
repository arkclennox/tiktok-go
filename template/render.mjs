// node render.mjs   — render penuh 1080x1920, frame JPEG q100 (tajam, hemat disk)
// Nama file WAJIB = nama penginapan (plan.json "nama"), mis. "Aston Jember Hotel & Conference Center" -> out/aston-jember-hotel-conference-center.mp4
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const nama = JSON.parse(fs.readFileSync("plan.json", "utf8")).nama;
if (!nama) throw new Error('isi "nama" (nama penginapan) di plan.json');
const slug = nama.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const out = `out/${slug}.mp4`;
const browserExecutable = (() => { // Chrome dari env REMOTION_CHROME atau ~/.config/tiktok-go/config.json "chrome"; kalau kosong Remotion mengunduh sendiri
  if (process.env.REMOTION_CHROME) return process.env.REMOTION_CHROME;
  try { const c = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/tiktok-go/config.json"), "utf8")).chrome; if (c && fs.existsSync(c)) return c; } catch {}
  return undefined;
})();
fs.mkdirSync(path.dirname(out), { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: "Promo", browserExecutable });
let last = -1;
await renderMedia({ composition, serveUrl, codec: "h264", crf: 16, imageFormat: "jpeg", jpegQuality: 100, audioCodec: "aac", audioBitrate: "256k",
  outputLocation: out, browserExecutable, concurrency: Number(process.env.RENDER_CONC || 3), // RENDER_CONC=1 kalau memori sempit
  timeoutInMilliseconds: 240000,
  onProgress: ({ progress }) => { const p = Math.floor(progress * 10); if (p !== last) { last = p; console.log(`${p * 10}%`); } } });
console.log("done", out);
