import React from "react";
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame, interpolate, spring, Easing } from "remotion";
import W from "./words.json";
import C from "./config.json";

export const FPS = 30;
export const TOTAL = Math.ceil(W.total * FPS);

type Word = { text: string; show: string; start: number; end: number };
type Line = { line: number; start: number; end: number; words: Word[] };
const LINES = W.lines as Line[];
const FONT = "Montserrat, sans-serif";
const ORANGE = "#FF9A1F";

// waktu kata: baris (1-based) + kata yang tampil (indeks kemunculan ke-n)
const at = (line: number, show?: string): number => {
  const L = LINES[line - 1];
  if (!show) return L.start;
  const w = L.words.find((x) => x.show === show);
  if (!w) throw new Error(`kata ${show} tidak ada di baris ${line}`);
  return w.start;
};
const lastEnd = (line: number) => LINES[line - 1].end;

// ---------- gambar per shot ----------
type Shot = { src: string; w: number; h: number; t: number; move: "zoomIn" | "zoomOut" | "panR" | "panL" | "tiltUp" | "drift" };
const SHOTS: Shot[] = (C.shots as any[]).map((x) => ({ src: x.src, w: x.w, h: x.h, move: x.move, t: x.line === 1 && !x.word ? 0 : at(x.line, x.word) }));

// guncangan tangan: jumlah beberapa sinus, beda fase per shot
const shake = (t: number, seed: number) => {
  const s = (f: number, p: number) => Math.sin(t * f + seed * 1.7 + p);
  return {
    x: 5 * s(1.3, 0) + 2.5 * s(3.1, 1) + 1.2 * s(7.3, 2),
    y: 4 * s(1.1, 3) + 2 * s(2.7, 4) + 1 * s(6.1, 5),
    r: 0.1 * s(0.9, 6) + 0.05 * s(2.3, 7),
  };
};

const ShotLayer: React.FC<{ s: Shot; i: number; t: number; dur: number }> = ({ s, i, t, dur }) => {
  const local = t - s.t;
  const p = Math.min(1, Math.max(0, local / dur));
  const e = Easing.inOut(Easing.sin)(p);
  const FW = 1080, FH = 1920;
  const base = Math.max(FW / s.w, FH / s.h) * 1.1; // sedikit lebih besar dari layar untuk ruang gerak
  let zoom = 1, dx = 0, dy = 0;
  const exX = (s.w * base - FW) / 2, exY = (s.h * base - FH) / 2;
  if (s.move === "zoomIn") zoom = 1 + 0.09 * e;
  if (s.move === "zoomOut") zoom = 1.09 - 0.09 * e;
  if (s.move === "panR") dx = interpolate(e, [0, 1], [exX, -exX]);
  if (s.move === "panL") dx = interpolate(e, [0, 1], [-exX, exX]);
  if (s.move === "tiltUp") { dy = interpolate(e, [0, 1], [-exY * 0.9, exY * 0.9]); zoom = 1.02; }
  if (s.move === "drift") { dx = interpolate(e, [0, 1], [exX * 0.6, -exX * 0.6]); zoom = 1 + 0.04 * e; }
  const k = shake(t, i);
  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#000" }}>
      <Img src={staticFile(`foto/${s.src}`)} style={{
        position: "absolute", left: "50%", top: "50%", width: s.w * base, height: s.h * base,
        transform: `translate(-50%, -50%) translate(${dx + k.x}px, ${dy + k.y}px) scale(${zoom}) rotate(${k.r}deg)`,
      }} />
    </AbsoluteFill>
  );
};

// ---------- judul ketik (0 s – akhir baris 1) ----------
const TITLE: string[] = C.title;
const Title: React.FC<{ t: number }> = ({ t }) => {
  const end = lastEnd(1) + 0.15;
  if (t > end) return null;
  const n = Math.floor(Math.max(0, t - 0.05) * 26); // 26 huruf per detik
  let left = n;
  const rows = TITLE.map((r) => { const s = r.slice(0, Math.max(0, left)); left -= r.length; return s; });
  return (
    <div style={{ position: "absolute", top: 470, width: "100%", textAlign: "center", fontFamily: FONT, fontWeight: 700,
      fontSize: 96, lineHeight: 1.08, color: "#fff", letterSpacing: -0.5,
      textShadow: "0 0 3px rgba(0,0,0,.9), 0 4px 14px rgba(0,0,0,.75), 0 2px 2px rgba(0,0,0,.8)" }}>
      {rows.map((r, i) => <div key={i} style={{ minHeight: 104 }}>{r}</div>)}
    </div>
  );
};

// ---------- caption: potongan 2–3 kata, kata yang sedang diucapkan oranye ----------
type Chunk = { words: Word[]; from: number; to: number };
const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  for (const L of LINES) {
    let cur: Word[] = [];
    const flush = () => { if (cur.length) out.push({ words: cur, from: cur[0].start, to: 0 }); cur = []; };
    L.words.filter((w) => w.show).forEach((w) => {
      const len = [...cur, w].map((x) => x.show).join(" ").length;
      if (cur.length >= 3 || (cur.length >= 2 && len > 19)) flush();
      cur.push(w);
      if (/[,.!?]$/.test(w.text)) flush();
    });
    flush();
  }
  out.sort((a, b) => a.from - b.from);
  out.forEach((c, i) => (c.to = i + 1 < out.length ? out[i + 1].from : c.words[c.words.length - 1].end + 0.6));
  return out;
})();

const Caption: React.FC<{ t: number }> = ({ t }) => {
  const c0 = CHUNKS.find((x) => t >= x.from - 0.03 && t < x.to - 0.03);
  if (!c0) return null;
  const c = c0;
  // kata aktif = kata terakhir yang sudah mulai diucapkan
  let active = 0;
  c.words.forEach((w, i) => { if (t >= w.start - 0.03) active = i; });
  return (
    <div style={{ position: "absolute", top: 1430, left: 70, right: 70, textAlign: "center", fontFamily: FONT, fontWeight: 800,
      fontSize: 58, lineHeight: 1.18, letterSpacing: 4, textTransform: "uppercase" }}>
      {c.words.map((w, i) => !w.show ? null : (
        <span key={i} style={{ color: i === active ? ORANGE : "#fff", WebkitTextStroke: "10px #000", paintOrder: "stroke fill",
          textShadow: "0 3px 6px rgba(0,0,0,.45)", marginRight: i < c.words.length - 1 ? 22 : 0 }}>{w.show}</span>
      ))}
    </div>
  );
};

// ---------- kartu pemesanan TikTok ----------
const CARD_FROM = at(C.card.from[0] as number, C.card.from[1] as string), CARD_TO = lastEnd(C.card.toLineEnd) - 0.2;
const Card: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  if (t < CARD_FROM || t > CARD_TO) return null;
  const sp = spring({ frame: frame - Math.round(CARD_FROM * FPS), fps: FPS, config: { damping: 14, stiffness: 180 } });
  const out = interpolate(t, [CARD_TO - 0.15, CARD_TO], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const f = "Montserrat, -apple-system, sans-serif";
  return (
    <div style={{ position: "absolute", top: 330, left: 225, width: 630, background: "#fff", borderRadius: 18,
      boxShadow: "0 12px 40px rgba(0,0,0,.35)", fontFamily: f, color: "#161823", padding: "22px 22px 24px",
      transform: `scale(${0.85 + 0.15 * sp})`, opacity: Math.min(sp * 1.3, 1) * out, transformOrigin: "50% 30%" }}>
      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ position: "relative", width: 150, height: 150, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
          <Img src={staticFile(`foto/${C.card.photo}`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", top: 0, left: 0, background: "#FE2C55", color: "#fff", fontSize: 19, fontWeight: 600,
            padding: "4px 10px", borderBottomRightRadius: 8 }}>{C.card.badge}</div>
        </div>
        <div style={{ flex: 1, paddingTop: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 600 }}>{C.card.name}</div>
            <div style={{ fontSize: 26, color: "#555" }}>⌃</div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            {C.card.chips.map((x) => (
              <span key={x} style={{ fontSize: 21, background: "#F1F1F2", color: "#555", padding: "5px 10px", borderRadius: 6 }}>{x}</span>
            ))}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, background: "#F8F8F8", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 22, lineHeight: 1.45 }}>
          {(C.card.notes as string[][]).map(([kind, txt]) => (
            <div key={txt} style={{ color: kind === "green" ? "#127C7C" : "#555" }}>{kind === "green" ? "✓" : "•"} {txt}</div>
          ))}
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}><span style={{ fontSize: 22 }}>Rp</span>{C.card.price}</div>
          <div style={{ fontSize: 19, color: "#FE2C55", marginTop: 4 }}>{C.card.priceNote}</div>
          <div style={{ marginTop: 18, background: "#FE2C55", color: "#fff", fontSize: 24, fontWeight: 600, padding: "10px 30px", borderRadius: 30 }}>{C.card.button}</div>
        </div>
      </div>
    </div>
  );
};

export const Promo: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  let idx = 0;
  SHOTS.forEach((s, i) => { if (t >= s.t) idx = i; });
  const s = SHOTS[idx];
  const dur = (SHOTS[idx + 1]?.t ?? W.total) - s.t;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <ShotLayer s={s} i={idx} t={t} dur={dur} />
      <Title t={t} />
      <Card t={t} frame={frame} />
      <Caption t={t} />
      <Audio src={staticFile("audio/vo.wav")} />
    </AbsoluteFill>
  );
};
