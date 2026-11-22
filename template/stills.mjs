// node stills.mjs 1.0,8.5,...  -> out/stills/s_<detik>.jpg (setengah ukuran) untuk cek cepat sebelum render penuh
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const browserExecutable = (() => { // Chrome dari env REMOTION_CHROME atau ~/.config/tiktok-go/config.json "chrome"; kalau kosong Remotion mengunduh sendiri
  if (process.env.REMOTION_CHROME) return process.env.REMOTION_CHROME;
  try { const c = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/tiktok-go/config.json"), "utf8")).chrome; if (c && fs.existsSync(c)) return c; } catch {}
  return undefined;
})();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const comp = await selectComposition({ serveUrl, id: "Promo", browserExecutable });
fs.mkdirSync("out/stills", { recursive: true });
for (const s of process.argv[2].split(",")) {
  await renderStill({ composition: comp, serveUrl, frame: Math.round(parseFloat(s) * 30), output: `out/stills/s_${s}.jpg`, imageFormat: "jpeg", scale: 0.5, browserExecutable });
  console.log("still", s);
}
