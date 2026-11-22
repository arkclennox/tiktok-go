// VO per kalimat lalu disusun saling tumpang: kalimat berikutnya mulai `overlap` detik sebelum suara kalimat sekarang habis.
// Hasil: voice/vo.wav + public/audio/vo.wav + src/words.json (kata dengan waktu absolut, untuk caption & potongan gambar).
// Pakai: node vo.mjs [--force]      (cache per kalimat di voice/sNN.*; dibuat ulang kalau teks/penyedia berubah)
//
// Penyedia suara diatur di script.json -> "tts" (lihat references/tts.md):
//   elevenlabs | openai (juga API lain yang kompatibel OpenAI) | voicestudio | command (perintah apa saja) | files (rekaman sendiri)
// Waktu per kata: dari penyedia kalau ada (ElevenLabs), kalau tidak -> whisper-cli (bila terpasang) -> bagi rata dalam rentang suara.
// Kunci API dibaca dari env atau dari berkas di ~/.config/tiktok-go/config.json -> "envFiles". Kunci TIDAK PERNAH dicetak atau disimpan.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";

const cfg = JSON.parse(fs.readFileSync("script.json", "utf8"));
const FORCE = process.argv.includes("--force");
const LOCAL = (() => { try { return JSON.parse(fs.readFileSync(path.join(os.homedir(), ".config/tiktok-go/config.json"), "utf8")); } catch { return {}; } })();
const expand = (p) => p.replace(/^~(?=\/|$)/, os.homedir());

// --- konfigurasi penyedia (kompatibel dengan script.json lama: voiceId/modelId/voiceSettings di level atas = ElevenLabs) ---
const tts = cfg.tts || { provider: "elevenlabs" };
if (tts.provider === "elevenlabs") {
  tts.voiceId ??= cfg.voiceId; tts.modelId ??= cfg.modelId ?? "eleven_multilingual_v2"; tts.voiceSettings ??= cfg.voiceSettings;
}
const LANG = cfg.language || "id";

function key(name) {
  if (process.env[name]) return process.env[name];
  for (const f of LOCAL.envFiles || []) {
    try { const m = fs.readFileSync(expand(f), "utf8").match(new RegExp(`^${name}=["']?([^"'\\s]+)`, "m")); if (m) return m[1]; } catch {}
  }
  throw new Error(`${name} tidak ada (set env ${name} atau tambahkan berkas .env di ~/.config/tiktok-go/config.json "envFiles")`);
}
const ff = (args) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...args]);
const dur = (f) => +execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim();

// --- penyedia: tiap fungsi menulis `out` (wav 44.1k mono) dan boleh mengembalikan words [{text,start,end}] ---
const providers = {
  async elevenlabs(text, out, i) {
    const prev = cfg.lines[i - 1], next = cfg.lines[i + 1];
    const body = { text, model_id: tts.modelId, language_code: LANG, voice_settings: tts.voiceSettings, seed: tts.seed ?? 7,
      ...(prev ? { previous_text: prev } : {}), ...(next ? { next_text: next } : {}) };
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${tts.voiceId}/with-timestamps?output_format=mp3_44100_128`,
      { method: "POST", headers: { "xi-api-key": key(tts.keyEnv || "ELEVENLABS_API_KEY"), "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`elevenlabs ${r.status} ${await r.text()}`);
    const d = await r.json();
    fs.writeFileSync(out + ".mp3", Buffer.from(d.audio_base64, "base64"));
    ff(["-i", out + ".mp3", "-ar", "44100", "-ac", "1", out]); fs.rmSync(out + ".mp3");
    return charsToWords(d.alignment);
  },
  async openai(text, out) {
    // OpenAI atau server lain yang kompatibel (/v1/audio/speech): baseUrl, model, voice, instructions, keyEnv
    const base = (tts.baseUrl || "https://api.openai.com/v1").replace(/\/$/, "");
    const headers = { "Content-Type": "application/json" };
    if (tts.keyEnv !== null) headers.Authorization = `Bearer ${key(tts.keyEnv || "OPENAI_API_KEY")}`;
    const r = await fetch(`${base}/audio/speech`, { method: "POST", headers,
      body: JSON.stringify({ model: tts.model || "gpt-4o-mini-tts", voice: tts.voice || "alloy", input: text, response_format: "wav",
        ...(tts.instructions ? { instructions: tts.instructions } : {}), ...(tts.speed ? { speed: tts.speed } : {}) }) });
    if (!r.ok) throw new Error(`openai ${r.status} ${await r.text()}`);
    fs.writeFileSync(out + ".raw", Buffer.from(await r.arrayBuffer()));
    ff(["-i", out + ".raw", "-ar", "44100", "-ac", "1", out]); fs.rmSync(out + ".raw");
  },
  async voicestudio(text, out) {
    // VoiceStudio lokal (POST /generate). Aplikasinya harus sudah terbuka — tanyakan pemilik sebelum membukanya.
    const base = (tts.baseUrl || "http://127.0.0.1:3900").replace(/\/$/, "");
    const fd = new FormData();
    fd.append("text", text); fd.append("language", LANG);
    if (tts.profileId) fd.append("profile_id", tts.profileId); else if (tts.instruct) fd.append("instruct", tts.instruct);
    if (tts.seed != null) fd.append("seed", String(tts.seed));
    const r = await fetch(`${base}/generate`, { method: "POST", body: fd });
    if (!r.ok) throw new Error(`voicestudio ${r.status} ${await r.text()}`);
    const ct = r.headers.get("content-type") || "";
    let buf;
    if (ct.includes("json")) { const j = await r.json(); const u = j.audio_url || j.url || j.path; if (!u) throw new Error("voicestudio: jawaban tanpa audio " + JSON.stringify(j).slice(0, 200));
      buf = u.startsWith("http") || u.startsWith("/") && !fs.existsSync(u) ? Buffer.from(await (await fetch(u.startsWith("http") ? u : base + u)).arrayBuffer()) : fs.readFileSync(u); }
    else buf = Buffer.from(await r.arrayBuffer());
    fs.writeFileSync(out + ".raw", buf);
    ff(["-i", out + ".raw", "-ar", "44100", "-ac", "1", out]); fs.rmSync(out + ".raw");
  },
  async command(text, out) {
    // "command": ["say","-v","Damayanti","-o","{out}.aiff","{text}"], "outputExt": "aiff"  (placeholder: {text} {out} {lang})
    const ext = tts.outputExt || "wav", tmp = `${out}.${ext}`;
    const args = tts.command.map((a) => a.replaceAll("{text}", text).replaceAll("{lang}", LANG).replaceAll("{out}", out));
    const r = spawnSync(args[0], args.slice(1), { stdio: ["ignore", "ignore", "pipe"] });
    if (r.status !== 0) throw new Error(`command gagal: ${r.stderr}`);
    ff(["-i", fs.existsSync(tmp) ? tmp : out, "-ar", "44100", "-ac", "1", out + ".tmp.wav"]); fs.renameSync(out + ".tmp.wav", out);
    if (fs.existsSync(tmp) && tmp !== out) fs.rmSync(tmp);
  },
  async files(text, out, i) {
    // rekaman sendiri: voice/rekaman/s01.wav (atau .mp3/.m4a) — satu berkas per baris naskah, urut
    const id = `s${String(i + 1).padStart(2, "0")}`;
    const src = ["wav", "mp3", "m4a", "aiff"].map((e) => path.join(tts.dir || "voice/rekaman", `${id}.${e}`)).find((f) => fs.existsSync(f));
    if (!src) throw new Error(`rekaman ${id} tidak ada di ${tts.dir || "voice/rekaman"}`);
    ff(["-i", src, "-ar", "44100", "-ac", "1", out]);
  },
};
if (!providers[tts.provider]) throw new Error(`penyedia tts "${tts.provider}" tidak dikenal: ${Object.keys(providers).join(", ")}`);

function charsToWords(al) {
  const ch = al.characters, st = al.character_start_times_seconds, en = al.character_end_times_seconds;
  const words = []; let cur = null;
  for (let k = 0; k < ch.length; k++) {
    if (/\s/.test(ch[k])) { if (cur) { words.push(cur); cur = null; } continue; }
    if (!cur) cur = { text: "", start: st[k], end: en[k] };
    cur.text += ch[k]; cur.end = en[k];
  }
  if (cur) words.push(cur);
  return words;
}

// --- penyelarasan kata untuk penyedia tanpa timestamp ---
function speechBounds(wav) {
  const r = spawnSync("ffmpeg", ["-i", wav, "-af", "silencedetect=noise=-35dB:d=0.12", "-f", "null", "-"], { encoding: "utf8" });
  const D = dur(wav); let a = 0, b = D;
  const starts = [...r.stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => +m[1]);
  const ends = [...r.stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => +m[1]);
  if (starts.length && starts[0] < 0.05 && ends.length) a = ends[0];
  const lastStart = starts[starts.length - 1];
  if (lastStart != null && lastStart > a + 0.3 && (ends.length < starts.length || ends[ends.length - 1] >= D - 0.05)) b = lastStart;
  return [a, b];
}
// peta waktu: pecahan panjang huruf kumulatif -> waktu (linear per potongan)
function mapByChars(tokens, anchors) {
  const W = tokens.map((t) => Math.max(1, t.replace(/[^\p{L}\p{N}]/gu, "").length));
  const tot = W.reduce((a, b) => a + b, 0); let acc = 0;
  const at = (f) => { for (let k = 1; k < anchors.length; k++) if (f <= anchors[k][0]) { const [f0, t0] = anchors[k - 1], [f1, t1] = anchors[k]; return t0 + (t1 - t0) * ((f - f0) / Math.max(1e-9, f1 - f0)); } return anchors[anchors.length - 1][1]; };
  return tokens.map((t, k) => { const s = at(acc / tot); acc += W[k]; const e = at(acc / tot); return { text: t, start: +s.toFixed(3), end: +Math.max(s + 0.05, e - 0.02).toFixed(3) }; });
}
function whisperAnchors(wav) {
  const bin = tts.whisperBin || LOCAL.whisperBin || "whisper-cli";
  const model = expand(tts.whisperModel || LOCAL.whisperModel || process.env.WHISPER_MODEL || "");
  if (!model || !fs.existsSync(model) || spawnSync(bin, ["--help"]).error) return null;
  const base = wav.replace(/\.wav$/, ".w");
  const r = spawnSync(bin, ["-m", model, "-l", LANG, "-f", wav, "-ojf", "-of", base, "-np"], { encoding: "utf8" });
  if (r.status !== 0 || !fs.existsSync(base + ".json")) return null;
  const j = JSON.parse(fs.readFileSync(base + ".json", "utf8")); fs.rmSync(base + ".json");
  const toks = [];
  for (const seg of j.transcription || []) for (const t of seg.tokens || []) {
    const txt = (t.text || "").trim(); if (!txt || txt.startsWith("[")) continue;
    toks.push({ len: txt.replace(/[^\p{L}\p{N}]/gu, "").length, s: t.offsets.from / 1000, e: t.offsets.to / 1000 });
  }
  const tot = toks.reduce((a, t) => a + t.len, 0); if (!tot) return null;
  let acc = 0; const an = [[0, toks[0].s]];
  for (const t of toks) { acc += t.len; if (t.len) an.push([acc / tot, t.e]); }
  return an;
}
function align(text, wav) {
  const tokens = text.split(/\s+/).filter(Boolean);
  const mode = cfg.align || "auto";
  if (mode !== "proportional") { const an = whisperAnchors(wav); if (an) return { words: mapByChars(tokens, an), how: "whisper" }; if (mode === "whisper") throw new Error("whisper-cli/model tidak tersedia"); }
  const [a, b] = speechBounds(wav);
  return { words: mapByChars(tokens, [[0, a], [1, b]]), how: "rata" };
}

// --- buat / ambil cache tiap kalimat ---
fs.mkdirSync("voice", { recursive: true });
const sig = crypto.createHash("sha1").update(JSON.stringify({ tts, LANG })).digest("hex").slice(0, 10);
const lines = [];
for (const [i, text] of cfg.lines.entries()) {
  const id = `s${String(i + 1).padStart(2, "0")}`, wav = `voice/${id}.wav`, js = `voice/${id}.json`;
  const cached = fs.existsSync(js) && fs.existsSync(wav) && JSON.parse(fs.readFileSync(js, "utf8"));
  let words, how;
  if (!FORCE && cached && cached.text === text && cached.sig === sig) ({ words, how } = cached);
  else {
    const got = await providers[tts.provider](text, wav, i);
    if (got && got.length) { words = got; how = tts.provider; } else ({ words, how } = align(text, wav));
    fs.writeFileSync(js, JSON.stringify({ text, sig, how, words }));
    console.log("suara", id, `(${tts.provider}, waktu kata: ${how})`);
  }
  lines.push({ id, wav, words, speechStart: words[0].start, speechEnd: words[words.length - 1].end });
}

// --- susun: tiap kalimat mulai `overlap` s sebelum suara kalimat sebelumnya habis ---
const placed = [];
for (const [i, L] of lines.entries()) {
  const offset = i === 0 ? 0.15 - L.speechStart : placed[i - 1].absEnd - cfg.overlap - L.speechStart;
  placed.push({ ...L, offset, absEnd: offset + L.speechEnd });
}
const total = placed[placed.length - 1].absEnd + 0.9;
const args = [];
placed.forEach((p) => args.push("-i", p.wav));
const f = placed.map((p, i) => `[${i}:a]adelay=${Math.max(0, Math.round(p.offset * 1000))}:all=1[a${i}]`).join(";")
  + ";" + placed.map((_, i) => `[a${i}]`).join("") + `amix=inputs=${placed.length}:normalize=0,atrim=0:${total.toFixed(2)},loudnorm=I=-14:TP=-1.5[out]`;
ff([...args, "-filter_complex", f, "-map", "[out]", "-ar", "48000", "voice/vo.wav"]);
fs.mkdirSync("public/audio", { recursive: true });
fs.copyFileSync("voice/vo.wav", "public/audio/vo.wav");

// --- kata absolut + teks tampilan (replace: "seratus ribuan" -> "100 RIBUAN"; kata sisa dikosongkan) ---
const rep = Object.entries(cfg.replace || {});
const out = placed.map((p, i) => {
  let ws = p.words.map((w) => ({ text: w.text, start: +(w.start + p.offset).toFixed(3), end: +(w.end + p.offset).toFixed(3) }));
  for (const [from, to] of rep) {
    const a = from.split(" "), b = to.split(" ");
    for (let k = 0; k + a.length <= ws.length; k++) {
      if (a.every((x, j) => ws[k + j].text.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, "") === x)) a.forEach((_, j) => (ws[k + j].show = b[j] ?? ""));
    }
  }
  ws = ws.map((w) => ({ ...w, show: (w.show ?? w.text).replace(/[,.!?]/g, "").toUpperCase() }));
  return { line: i + 1, start: +(p.offset + p.speechStart).toFixed(3), end: +p.absEnd.toFixed(3), words: ws };
});
fs.writeFileSync("src/words.json", JSON.stringify({ total: +total.toFixed(2), lines: out }, null, 1));
console.log(`total ${total.toFixed(2)} s`);
out.forEach((l) => console.log(String(l.line).padStart(2), l.start.toFixed(2), "-", l.end.toFixed(2), l.words.map((w) => w.show).join(" ")));
