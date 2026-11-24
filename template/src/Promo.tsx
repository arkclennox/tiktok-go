// tiktok-go — bahasa edit v2 ("tidak monoton").
// Semua efek dipilih per shot/baris di plan.json (lihat references/gaya.md). Sumber teknik dicatat di gaya.md.
import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, staticFile, useCurrentFrame, interpolate, spring, Easing } from "remotion";
import W from "./words.json";
import C0 from "./config.json";

const C = C0 as any;
export const FPS = 30;
export const TOTAL = Math.ceil(W.total * FPS);
const FW = 1080, FH = 1920;

type Word = { text: string; show: string; start: number; end: number };
type Line = { line: number; start: number; end: number; words: Word[] };
const LINES = W.lines as Line[];
// huruf utama per video (look.font, lint memaksa beda dari video sebelumnya): montserrat | anton (tinggi ramping) | archivo (lebar tebal) | fraunces (serif, cocok tier mahal)
const FAMS: Record<string, string> = { montserrat: "Montserrat", anton: "Anton", archivo: "ArchivoBlack", fraunces: "Fraunces" };
const FAM = FAMS[(C.look && C.look.font) || "montserrat"] || "Montserrat";
const FONT = `${FAM}, sans-serif`;
// warna brand akun (~/.config/tiktok-go/config.json "brand", disalin prep.py) — semua aksen ikut brand
const BRAND = { light: "#FEB142", mid: "#FE8F1E", deep: "#F1541A", ...(C.brand || {}) };
const LOOK = { grade: "none", grain: 0, vignette: 0.25, accent: BRAND.mid, shake: 0.18, ...(C.look || {}) };
const ACC: string = C.brand ? BRAND.mid : LOOK.accent;
const GRAD = `linear-gradient(135deg, ${BRAND.light} 0%, ${BRAND.mid} 55%, ${BRAND.deep} 100%)`;
// ukur lebar teks dengan font asli (Montserrat sudah dimuat sebelum render) -> ukuran huruf dikecilkan sampai muat. TIDAK ADA kata terpotong.
let _ctx: CanvasRenderingContext2D | null = null;
const SCRIPT = "Caveat, cursive"; // tulisan tangan (gaya note / tiket / label polaroid)
let _fam = FAM;
const textW = (txt: string, weight: number, size: number, ls = 0) => {
  if (!_ctx) _ctx = document.createElement("canvas").getContext("2d");
  _ctx!.font = `${weight} ${size}px ${_fam}`;
  return _ctx!.measureText(txt).width + ls * txt.length;
};
const fit = (txt: string, weight: number, size: number, maxW: number, ls = 0, extra = 0) => {
  const w = textW(txt, weight, size, ls) + extra;
  return w > maxW ? Math.floor((size * maxW) / w) : size;
};
const fitS = (txt: string, weight: number, size: number, maxW: number, extra = 0) => { _fam = "Caveat"; const r = fit(txt, weight, size, maxW, 0, extra); _fam = FAM; return r; };
const SAFE = 940; // lebar aman (1080 - 2 x 70)
const EMPH = new Set<string>(C.emph || []);

const at = (line: number, show?: string): number => {
  const L = LINES[line - 1];
  if (!show) return L.start;
  const w = L.words.find((x) => x.show === show);
  if (!w) throw new Error(`kata ${show} tidak ada di baris ${line}`);
  return w.start;
};
const lastEnd = (line: number) => LINES[line - 1].end;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const eo3 = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const ei3 = (x: number) => Math.pow(clamp01(x), 3);
const expoOut = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * clamp01(x)));
const backOut = (x: number) => { const c = 1.7, y = clamp01(x) - 1; return 1 + (c + 1) * y * y * y + c * y * y; };

// ---------- guncangan kamera genggam ----------
// Angka profil = nilai terukur preset noise Cinemachine (via komponen camera-shake hyperframes-registry):
// [amplitudo derajat, frekuensi Hz] per oktaf, sumbu X (pitch) dan Y (yaw). Diproyeksikan ke px dengan lensa 60° vertikal.
const PROFILE = [[[7, 0.15], [5, 0.1]], [[4, 0.8], [2, 0.75]], [[1, 1.2], [0.8, 1.5]]];
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (u: number, seed: number) => { const i = Math.floor(u), f = u - i, k = f * f * (3 - 2 * f); return hash(i + seed * 101) * (1 - k) + hash(i + 1 + seed * 101) * k; };
const D = FH / 2 / Math.tan(Math.PI / 6);
const shake = (t: number, seed: number, intensity: number) => {
  let pitch = 0, yaw = 0;
  PROFILE.forEach((o, k) => {
    pitch += (vnoise(o[0][1] * t + seed * 7.13 + k * 3, k * 3 + seed) - 0.5) * o[0][0] * intensity;
    yaw += (vnoise(o[1][1] * t + seed * 5.71 + k * 3 + 1, k * 3 + 1 + seed) - 0.5) * o[1][0] * intensity;
  });
  const r = Math.PI / 180;
  return { x: D * Math.tan(yaw * r), y: D * Math.tan(pitch * r), r: (vnoise(0.4 * t + seed, 77 + seed) - 0.5) * 1.2 * intensity };
};

// ---------- shot ----------
type Move = "zoomIn" | "zoomOut" | "panR" | "panL" | "tiltUp" | "tiltDown" | "drift" | "ramp" | "punch" | "dolly3d" | "roll";
type Shot = { src: string; w: number; h: number; t: number; move: Move; in: string; layout: string; extra: any[]; punchT?: number; label?: string; z: number; oy: number };
const SHOTS: Shot[] = (C.shots as any[]).map((x) => ({
  src: x.src, w: x.w, h: x.h, move: x.move || "zoomIn", in: x.in || "cut", layout: x.layout || "full", extra: x.extra || [], label: x.label, z: x.z || 1, oy: x.oy || 0,
  t: x.line === 1 && !x.word ? 0 : at(x.line, x.word), punchT: x.punch ? at(x.punch[0], x.punch[1]) : undefined,
}));
const startOf = (i: number) => SHOTS[i].t;
const endOf = (i: number) => SHOTS[i + 1]?.t ?? W.total;

const Photo: React.FC<{ src: string; w: number; h: number; boxW: number; boxH: number; zoom?: number; dx?: number; dy?: number; extra?: string; style?: React.CSSProperties }> =
  ({ src, w, h, boxW, boxH, zoom = 1, dx = 0, dy = 0, extra = "", style }) => {
    const base = Math.max(boxW / w, boxH / h) * 1.08;
    return (
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", ...style }}>
        <Img src={staticFile(`foto/${src}`)} style={{ position: "absolute", left: "50%", top: "50%", width: w * base, height: h * base,
          transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(${zoom}) ${extra}` }} />
      </div>
    );
  };

// gerak kamera untuk tata letak penuh
const camera = (s: Shot, t: number) => {
  const dur = Math.max(0.5, (SHOTS[SHOTS.indexOf(s) + 1]?.t ?? W.total) - s.t);
  const local = t - s.t, p = clamp01(local / dur), e = Easing.inOut(Easing.sin)(p);
  const base = Math.max(FW / s.w, FH / s.h) * 1.08;
  const exX = (s.w * base - FW) / 2, exY = (s.h * base - FH) / 2;
  let zoom = 1, dx = 0, dy = 0, rot = 0, rotY = 0, blur = 0, shakeBoost = 0;
  switch (s.move) {
    case "zoomIn": zoom = 1 + 0.1 * e; break;
    case "zoomOut": zoom = 1.1 - 0.1 * e; break;
    case "panR": dx = interpolate(e, [0, 1], [exX, -exX]); zoom = 1.02; break;
    case "panL": dx = interpolate(e, [0, 1], [-exX, exX]); zoom = 1.02; break;
    case "tiltUp": dy = interpolate(e, [0, 1], [-exY * 0.9, exY * 0.9]); zoom = 1.03; break;
    case "tiltDown": dy = interpolate(e, [0, 1], [exY * 0.9, -exY * 0.9]); zoom = 1.03; break;
    case "drift": dx = interpolate(e, [0, 1], [exX * 0.6, -exX * 0.6]); zoom = 1 + 0.05 * e; break;
    // speed ramp: 80% gerak di 0,35 s pertama lalu merayap (pola "extended keyframe")
    case "ramp": { const q = expoOut(local / 0.45); zoom = 1.38 - 0.34 * q - 0.04 * e; blur = 10 * (1 - clamp01(local / 0.2)); break; }
    // crash zoom di kata pemicu `punch`
    case "punch": { const tp = s.punchT ?? s.t + dur * 0.55; const k = expoOut((t - tp) / 0.12); zoom = 1 + 0.03 * e + (t >= tp ? 0.16 * k : 0);
      blur = t >= tp ? 6 * (1 - clamp01((t - tp) / 0.1)) : 0; shakeBoost = t >= tp ? 1.6 * Math.max(0, 1 - (t - tp) / 0.4) : 0; break; }
    case "dolly3d": rotY = interpolate(e, [0, 1], [-8, 8]); zoom = 1.16 + 0.04 * e; dx = interpolate(e, [0, 1], [-exX * 0.3, exX * 0.3]); break;
    case "roll": rot = interpolate(e, [0, 1], [-3, 1.2]); zoom = 1.1 - 0.05 * e; break;
  }
  return { zoom, dx, dy, rot, rotY, blur, shakeBoost };
};

// tata letak: full | split2 | split3 | grid4 | frame
const ShotView: React.FC<{ s: Shot; i: number; t: number }> = ({ s, i, t }) => {
  const local = t - s.t, dur = endOf(i) - s.t, p = clamp01(local / dur);
  if (s.layout === "full") {
    const c = camera(s, t);
    const k = shake(t, i + 1, LOOK.shake * (1 + c.shakeBoost));
    return (
      <AbsoluteFill style={{ background: "#000", perspective: 1400, overflow: "hidden", filter: c.blur ? `blur(${c.blur}px)` : undefined }}>
        <Photo src={s.src} w={s.w} h={s.h} boxW={FW} boxH={FH} zoom={c.zoom * s.z} dx={c.dx + k.x} dy={c.dy + k.y + s.oy} extra={`rotate(${c.rot + k.r}deg) rotateY(${c.rotY}deg)`} />
      </AbsoluteFill>
    );
  }
  const all = [{ src: s.src, w: s.w, h: s.h }, ...s.extra];
  const k = shake(t, i + 3, LOOK.shake * 0.6);
  if (s.layout === "split2" || s.layout === "split3") {
    const n = s.layout === "split2" ? 2 : 3, gap = 12, bh = (FH - gap * (n - 1)) / n;
    return (
      <AbsoluteFill style={{ background: "#fff" }}>
        {all.slice(0, n).map((ph, j) => {
          const q = eo3((local - j * 0.09) / 0.38), dir = j % 2 ? 1 : -1;
          const pan = interpolate(p, [0, 1], [dir * 30, -dir * 30]);
          return (
            <div key={j} style={{ position: "absolute", left: 0, top: j * (bh + gap), width: FW, height: bh, overflow: "hidden",
              transform: `translateX(${(1 - q) * dir * FW}px)` }}>
              <Photo src={ph.src} w={ph.w} h={ph.h} boxW={FW} boxH={bh} zoom={1.04 + 0.05 * p} dx={pan + k.x * 0.3} dy={k.y * 0.3} />
            </div>
          );
        })}
      </AbsoluteFill>
    );
  }
  if (s.layout === "grid4") {
    const gap = 12, cw = (FW - gap) / 2, ch = (FH - gap) / 2;
    return (
      <AbsoluteFill style={{ background: "#111" }}>
        {all.slice(0, 4).map((ph, j) => {
          const sp = spring({ frame: Math.round((local - j * 0.11) * FPS), fps: FPS, config: { damping: 13, stiffness: 170 } });
          return (
            <div key={j} style={{ position: "absolute", left: (j % 2) * (cw + gap), top: Math.floor(j / 2) * (ch + gap), width: cw, height: ch, overflow: "hidden",
              transform: `scale(${0.4 + 0.6 * sp})`, opacity: clamp01(sp * 1.5), borderRadius: 6 }}>
              <Photo src={ph.src} w={ph.w} h={ph.h} boxW={cw} boxH={ch} zoom={1 + 0.06 * p} />
            </div>
          );
        })}
      </AbsoluteFill>
    );
  }
  // frame: foto jadi kartu polaroid jatuh di atas versi buramnya + kilat kamera (pola freeze-frame dressing)
  const sp = spring({ frame: Math.round(local * FPS), fps: FPS, config: { damping: 12, stiffness: 120 } });
  const cardW = 900, ratio = s.h / s.w, ph = Math.min(1250, cardW * ratio);
  const flash = local < 0.3 ? interpolate(local, [0.18, 0.24, 0.48], [0, 0.85, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) : 0;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Photo src={s.src} w={s.w} h={s.h} boxW={FW} boxH={FH} zoom={1.25 + 0.05 * p} style={{ filter: "blur(28px) brightness(.5) saturate(1.2)" }} />
      <div style={{ position: "absolute", left: (FW - cardW) / 2 - 22, top: (FH - ph) / 2 - 90, width: cardW + 44, padding: "22px 22px 120px", background: "#fafafa",
        boxShadow: "0 30px 80px rgba(0,0,0,.6)", transform: `translateY(${(1 - sp) * -1500}px) rotate(${interpolate(sp, [0, 1], [-14, -2.5]) + k.r * 2}deg)` }}>
        <div style={{ position: "relative", width: cardW, height: ph, overflow: "hidden" }}>
          <Photo src={s.src} w={s.w} h={s.h} boxW={cardW} boxH={ph} zoom={1 + 0.07 * p} />
        </div>
        {s.label ? <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, textAlign: "center", fontFamily: SCRIPT, fontWeight: 700, fontSize: fitS(s.label, 700, 76, 780), color: "#222", whiteSpace: "nowrap" }}>{s.label}</div> : null}
      </div>
      <AbsoluteFill style={{ background: "#fff", opacity: flash }} />
    </AbsoluteFill>
  );
};

// ---------- transisi (masuk ke shot) ----------
// pre/post = detik sebelum/sesudah titik potong. Durasi & kurva dari blok hyperframes-registry (transitions-other/-light, whip-pan, cinematic-zoom).
const TR: Record<string, [number, number]> = {
  cut: [0, 0], flash: [0.04, 0.14], dip: [0.1, 0.1], leak: [0.25, 0.35], zoom: [0.18, 0.2], spin: [0.15, 0.17],
  whipL: [0.12, 0.13], whipR: [0.12, 0.13], whipU: [0.12, 0.13], whipD: [0.12, 0.13], push: [0, 0.32], drop: [0, 0.5], iris: [0, 0.42], slice: [0, 0.42], glitch: [0.07, 0.1],
};
const DirBlur: React.FC<{ id: string; x: number; y: number }> = ({ id, x, y }) => (
  <svg width="0" height="0" style={{ position: "absolute" }}><filter id={id} x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={`${x} ${y}`} /></filter></svg>
);
const RGBSplit: React.FC<{ id: string; d: number }> = ({ id, d }) => (
  <svg width="0" height="0" style={{ position: "absolute" }}>
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
      <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
      <feOffset in="r" dx={d} dy={0} result="r2" />
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
      <feOffset in="b" dx={-d} dy={0} result="b2" />
      <feBlend in="r2" in2="g" mode="screen" result="rg" />
      <feBlend in="rg" in2="b2" mode="screen" />
    </filter>
  </svg>
);

const Picture: React.FC<{ t: number }> = ({ t }) => {
  let idx = 0;
  SHOTS.forEach((s, i) => { if (t >= s.t) idx = i; });
  // sedang transisi ke shot berikut (bagian "pre") atau baru masuk shot ini (bagian "post")?
  let a = -1, b = idx, p = 1, kind = "cut";
  const nx = SHOTS[idx + 1];
  if (nx && nx.in !== "cut" && t >= nx.t - TR[nx.in][0]) { a = idx; b = idx + 1; kind = nx.in; }
  else if (idx > 0 && SHOTS[idx].in !== "cut" && t < SHOTS[idx].t + TR[SHOTS[idx].in][1]) { a = idx - 1; b = idx; kind = SHOTS[idx].in; }
  if (a < 0) return <ShotView s={SHOTS[idx]} i={idx} t={t} />;
  const [pre, post] = TR[kind];
  const T0 = SHOTS[b].t;
  p = clamp01((t - (T0 - pre)) / (pre + post));
  const after = t >= T0;
  const A = <ShotView s={SHOTS[a]} i={a} t={t} />, B = <ShotView s={SHOTS[b]} i={b} t={Math.max(t, T0)} />;
  const lay = (el: React.ReactNode, style: React.CSSProperties, key: string) => <AbsoluteFill key={key} style={style}>{el}</AbsoluteFill>;
  const half = pre / (pre + post);
  switch (kind) {
    case "flash": case "dip": {
      const o = after ? 1 - eo3((t - T0) / post) : ei3((t - (T0 - pre)) / pre);
      return <AbsoluteFill>{after ? B : A}<AbsoluteFill style={{ background: kind === "flash" ? "#fff" : "#000", opacity: o * (kind === "flash" ? 0.95 : 1) }} /></AbsoluteFill>;
    }
    case "leak": {
      // bocoran cahaya hangat menyapu layar, potongan di puncak terang
      const o = Math.sin(Math.PI * p);
      const x = interpolate(p, [0, 1], [-500, 500]);
      return (
        <AbsoluteFill>
          {after ? B : A}
          <AbsoluteFill style={{ mixBlendMode: "screen", opacity: o, transform: `translateX(${x}px)`,
            background: "radial-gradient(ellipse 55% 40% at 35% 45%, rgba(255,150,40,.95), rgba(255,80,20,.55) 45%, transparent 75%), radial-gradient(ellipse 40% 60% at 75% 60%, rgba(255,220,120,.9), transparent 70%)" }} />
          <AbsoluteFill style={{ background: "#fff6e0", opacity: Math.max(0, o - 0.55) * 1.4, mixBlendMode: "screen" }} />
        </AbsoluteFill>
      );
    }
    case "zoom": {
      const qa = ei3(p / half), qb = eo3((p - half) / (1 - half));
      return after
        ? lay(B, { transform: `scale(${1.35 - 0.35 * qb})`, filter: `blur(${14 * (1 - qb)}px)` }, "b")
        : lay(A, { transform: `scale(${1 + 0.8 * qa})`, filter: `blur(${16 * qa}px)` }, "a");
    }
    case "spin": {
      const qa = ei3(p / half), qb = eo3((p - half) / (1 - half));
      return after
        ? lay(B, { transform: `rotate(${28 * (1 - qb)}deg) scale(${1.5 - 0.5 * qb})`, filter: `blur(${12 * (1 - qb)}px)` }, "b")
        : lay(A, { transform: `rotate(${-28 * qa}deg) scale(${1 + 0.5 * qa})`, filter: `blur(${12 * qa}px)` }, "a");
    }
    case "whipL": case "whipR": case "whipU": case "whipD": {
      const hz = kind === "whipL" || kind === "whipR", dir = kind === "whipL" || kind === "whipU" ? -1 : 1; // arah gerak isi layar
      // kamera disentak: shot lama & baru menempel dan meluncur bersama, buram searah gerak (puncak di titik potong)
      const size = hz ? FW : FH, u = Easing.bezier(0.6, 0, 0.4, 1)(p), bl = 110 * Math.sin(Math.PI * p), id = `wb${b}`;
      const offA = dir * u * size, offB = offA - dir * size;
      const tr = (o: number) => (hz ? `translateX(${o}px)` : `translateY(${o}px)`);
      return (
        <AbsoluteFill>
          <DirBlur id={id} x={hz ? bl : 0} y={hz ? 0 : bl} />
          <AbsoluteFill style={{ filter: `url(#${id})` }}>
            {lay(A, { transform: tr(offA) }, "a")}
            {lay(B, { transform: tr(offB) }, "b")}
          </AbsoluteFill>
        </AbsoluteFill>
      );
    }
    case "push": {
      const q = Easing.bezier(0.7, 0, 0.2, 1)(p);
      return (
        <AbsoluteFill>
          {lay(A, { transform: `translateY(${-q * FH}px) scale(${1 - 0.08 * q})`, filter: `brightness(${1 - 0.4 * q})` }, "a")}
          {lay(B, { transform: `translateY(${(1 - q) * FH}px)`, boxShadow: "0 -20px 60px rgba(0,0,0,.6)" }, "b")}
        </AbsoluteFill>
      );
    }
    case "drop": {
      // "gravity drop": shot lama jatuh (y +2100, miring 6°, power3.in) memperlihatkan shot baru di bawahnya
      const q = ei3(p);
      return (
        <AbsoluteFill>
          {lay(B, { transform: `scale(${1.06 - 0.06 * p})` }, "b")}
          {lay(A, { transform: `translateY(${q * 2100}px) rotate(${6 * q}deg)`, boxShadow: "0 0 80px rgba(0,0,0,.7)", transformOrigin: "20% 100%" }, "a")}
        </AbsoluteFill>
      );
    }
    case "iris": {
      const r = eo3(p) * 1250;
      return (
        <AbsoluteFill>
          {A}
          {lay(B, { clipPath: `circle(${r}px at 50% 52%)` }, "b")}
          <div style={{ position: "absolute", left: FW / 2 - r, top: FH * 0.52 - r, width: 2 * r, height: 2 * r, borderRadius: "50%", border: `${10 * (1 - p)}px solid ${ACC}`, opacity: 1 - p }} />
        </AbsoluteFill>
      );
    }
    case "slice": {
      const n = 4, w = FW / n;
      return (
        <AbsoluteFill>
          {A}
          {Array.from({ length: n }).map((_, j) => {
            const q = Easing.bezier(0.8, 0, 0.2, 1)(clamp01((p - j * 0.09) / 0.64));
            return <AbsoluteFill key={j} style={{ clipPath: `inset(0 ${FW - (j + 1) * w}px 0 ${j * w}px)`, transform: `translateY(${(j % 2 ? -1 : 1) * (1 - q) * FH}px)` }}>{B}</AbsoluteFill>;
          })}
        </AbsoluteFill>
      );
    }
    case "glitch": {
      const d = Math.sin(Math.PI * p) * 38, id = `gl${b}`;
      const bars = [0.18, 0.41, 0.63, 0.82].map((y, j) => ({ y, h: 40 + 50 * hash(j + b), x: (hash(j * 3 + b + Math.floor(t * 30)) - 0.5) * 160 * Math.sin(Math.PI * p) }));
      return (
        <AbsoluteFill>
          <RGBSplit id={id} d={d} />
          {lay(after ? B : A, { filter: `url(#${id})` }, "g")}
          {bars.map((br, j) => (
            <AbsoluteFill key={j} style={{ clipPath: `inset(${br.y * FH}px 0 ${FH - br.y * FH - br.h}px 0)`, transform: `translateX(${br.x}px)` }}>{after ? B : A}</AbsoluteFill>
          ))}
        </AbsoluteFill>
      );
    }
  }
  return B;
};

// ---------- hentakan di kata (beat-accent: pulsa skala, kilat, guncang) ----------
type Hit = { t: number; fx: string };
const HITS: Hit[] = (C.hits || []).map((h: any) => ({ t: at(h.line, h.word), fx: h.fx }));
const hitFx = (t: number) => {
  let scale = 1, flash = 0, sx = 0, sy = 0, tint = 0;
  for (const h of HITS) {
    const d = t - h.t;
    if (d < 0 || d > 0.6) continue;
    if (h.fx === "pulse") { scale *= d < 0.06 ? 1 + 0.07 * expoOut(d / 0.06) : 1 + 0.07 * (1 - eo3((d - 0.06) / 0.3)); tint = Math.max(tint, 0.35 * (1 - clamp01(d / 0.25))); }
    if (h.fx === "flash") flash = Math.max(flash, d < 0.04 ? d / 0.04 : 1 - eo3((d - 0.04) / 0.22));
    if (h.fx === "shake") { const a = 26 * Math.max(0, 1 - d / 0.35); sx += a * Math.sin(d * 95); sy += a * 0.5 * Math.cos(d * 71); }
    if (h.fx === "zoom") scale *= 1 + 0.12 * (d < 0.08 ? expoOut(d / 0.08) : 1 - eo3((d - 0.4) / 0.2) * (d > 0.4 ? 1 : 0));
  }
  return { scale, flash: clamp01(flash), sx, sy, tint };
};

// ---------- judul (gaya: type | stamp | mask | slam) ----------
const TITLE: string[] = C.title;
const TSTYLE: string = C.titleStyle || "type";
const tShadow = "0 0 3px rgba(0,0,0,.9), 0 4px 14px rgba(0,0,0,.75), 0 2px 2px rgba(0,0,0,.8)";
const Title: React.FC<{ t: number }> = ({ t }) => {
  const end = Math.min(lastEnd(1) + 0.15, CARD_FROM); // judul keluar sebelum kartu harga masuk (tidak bertumpuk)
  if (t > end) return null;
  const out = 1 - clamp01((t - (end - 0.15)) / 0.15);
  const box: React.CSSProperties = { position: "absolute", top: C.titleY ?? 450, width: "100%", textAlign: "center", fontFamily: FONT, color: "#fff", opacity: out };
  if (TSTYLE === "type") {
    let left = Math.floor(Math.max(0, t - 0.05) * 26);
    const rows = TITLE.map((r) => { const s = r.slice(0, Math.max(0, left)); left -= r.length; return s; });
    return <div style={{ ...box, fontWeight: 700, fontSize: 96, lineHeight: 1.08, textShadow: tShadow }}>{rows.map((r, i) => <div key={i} style={{ minHeight: 104 }}>{r}</div>)}</div>;
  }
  if (TSTYLE === "stamp") {
    // tiap baris dicap: skala 1.8→1 + buram→tajam, baris 2 di kotak aksen
    return (
      <div style={box}>
        {TITLE.map((r, i) => {
          const q = expoOut((t - 0.05 - i * 0.3) / 0.2);
          const wipe = eo3((t - 0.3 - i * 0.3) / 0.25);
          return (
            <div key={i} style={{ marginTop: i ? 18 : 0, transform: `scale(${1.8 - 0.8 * q})`, opacity: clamp01(q * 3), filter: `blur(${(1 - q) * 14}px)` }}>
              <span style={{ position: "relative", isolation: "isolate", display: "inline-block", padding: i ? "4px 26px 10px" : 0, fontWeight: i ? 900 : 800, fontSize: fit(r, i ? 900 : 800, i ? 92 : 104, SAFE, 0, i ? 52 : 0), whiteSpace: "nowrap",
                color: "#fff", textShadow: i ? "0 2px 6px rgba(120,30,0,.45)" : tShadow, letterSpacing: -1 }}>
                {i ? <span style={{ position: "absolute", inset: 0, background: GRAD, transform: `scaleX(${wipe})`, transformOrigin: "0 50%", zIndex: -1, borderRadius: 8 }} /> : null}
                <span style={{ position: "relative" }}>{r}</span>
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  if (TSTYLE === "mask") {
    // huruf naik dari bawah garis (bottom-up letters), jeda 0,028 s per huruf
    let n = 0;
    return (
      <div style={{ ...box, fontWeight: 900, lineHeight: 1.05, textShadow: tShadow, textTransform: "uppercase", letterSpacing: 2 }}>
        {TITLE.map((r, i) => (
          <div key={i} style={{ overflow: "hidden", paddingBottom: 10, color: i ? ACC : "#fff", fontSize: fit(r.toUpperCase(), 900, 100, SAFE, 2), whiteSpace: "nowrap" }}>
            {[...r].map((ch, j) => { const q = backOut((t - 0.05 - (n++) * 0.028) / 0.3); return <span key={j} style={{ display: "inline-block", transform: `translateY(${(1 - q) * 120}%)`, whiteSpace: "pre" }}>{ch}</span>; })}
          </div>
        ))}
      </div>
    );
  }
  if (TSTYLE === "note") {
    // catatan tulisan tangan: kata muncul UTUH satu per satu (naik + miring kecil), lalu garis bawah gradasi brand digambar (SVG)
    const words = TITLE.join(" ").split(" ");
    const per = Math.min(0.2, (end - 0.6) / words.length);
    let k = 0;
    return (
      <div style={{ ...box, top: C.titleY ?? 420, fontFamily: SCRIPT, fontWeight: 700, lineHeight: 1.0, textShadow: "0 3px 12px rgba(0,0,0,.75), 0 0 2px rgba(0,0,0,.8)" }}>
        {TITLE.map((r, i) => {
          const size = fitS(r, 700, i ? 150 : 130, SAFE, r.split(" ").length * 24);
          const row = (
            <div key={i} style={{ position: "relative", fontSize: size, whiteSpace: "nowrap", color: i ? BRAND.light : "#fff", transform: `rotate(${i ? -3 : -1.5}deg)` }}>
              {r.split(" ").map((w, j) => { const q = backOut((t - 0.05 - (k++) * per) / 0.25);
                return <span key={j} style={{ display: "inline-block", margin: "0 12px", opacity: clamp01(q * 3), transform: `translateY(${(1 - q) * 40}px) rotate(${(1 - q) * -8}deg)` }}>{w}</span>; })}
              {i === TITLE.length - 1 ? (() => { const d = eo3((t - 0.1 - words.length * per) / 0.35); return (
                <svg width="760" height="60" viewBox="0 0 760 60" style={{ position: "absolute", left: "50%", bottom: -34, transform: "translateX(-50%)" }}>
                  <defs><linearGradient id="ul" x1="0" x2="1"><stop offset="0" stopColor={BRAND.light} /><stop offset=".55" stopColor={BRAND.mid} /><stop offset="1" stopColor={BRAND.deep} /></linearGradient></defs>
                  <path d="M20 38 C 180 14, 420 52, 740 22" stroke="url(#ul)" strokeWidth="14" fill="none" strokeLinecap="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - d} />
                </svg>); })() : null}
            </div>);
          return row;
        })}
      </div>
    );
  }
  // slam: kata judul satu per satu menghantam dari arah bergantian
  const words = TITLE.join(" ").split(" ");
  const per = Math.min(0.32, (end - 0.4) / words.length);
  let row = 0;
  return (
    <div style={{ ...box, fontWeight: 900, lineHeight: 1.1, textShadow: tShadow, textTransform: "uppercase" }}>
      {TITLE.map((r, i) => (
        <div key={i} style={{ fontSize: fit(r.toUpperCase(), 900, 104, SAFE, 0, r.split(" ").length * 28), whiteSpace: "nowrap" }}>{r.split(" ").map((w, j) => {
          const k = row++, q = expoOut((t - 0.05 - k * per) / 0.16);
          const from = [[-700, 0], [700, 0], [0, -500], [0, 500]][k % 4];
          return <span key={j} style={{ display: "inline-block", margin: "0 14px", color: i ? ACC : "#fff", opacity: q > 0 ? 1 : 0,
            transform: `translate(${from[0] * (1 - q)}px,${from[1] * (1 - q)}px) scale(${1.4 - 0.4 * q})` }}>{w}</span>;
        })}</div>
      ))}
    </div>
  );
};

// ---------- caption per baris (gaya: karaoke | box | slam | emph | stack | typeon) ----------
type Chunk = { words: Word[]; from: number; to: number; line: number; style: string };
const CAPSTYLE: Record<number, string> = {};
const CAPY: Record<number, number> = {};
(C.captions || []).forEach((c: any) => { CAPSTYLE[c.line] = c.style; if (c.y) CAPY[c.line] = c.y; });
const CHUNKS: Chunk[] = (() => {
  const out: Chunk[] = [];
  for (const L of LINES) {
    const style = CAPSTYLE[L.line] || "karaoke";
    const max = style === "slam" ? 1 : style === "stack" ? 3 : style === "typeon" || style === "note" ? 4 : 3, maxLen = style === "typeon" ? 26 : style === "note" ? 22 : 19;
    let cur: Word[] = [];
    const flush = () => { if (cur.length) out.push({ words: cur, from: cur[0].start, to: 0, line: L.line, style }); cur = []; };
    L.words.filter((w) => w.show).forEach((w) => {
      const len = [...cur, w].map((x) => x.show).join(" ").length;
      // slam: kata pendek (≤3 huruf) digabung dengan kata berikutnya
      const short = style === "slam" && cur.length === 1 && cur[0].show.length <= 3;
      if (!short && (cur.length >= max || (cur.length >= 2 && len > maxLen))) flush();
      cur.push(w);
      if (/[,.!?]$/.test(w.text)) flush();
    });
    flush();
  }
  out.sort((a, b) => a.from - b.from);
  out.forEach((c, i) => (c.to = i + 1 < out.length ? out[i + 1].from : c.words[c.words.length - 1].end + 0.6));
  return out;
})();
const stroke = (px: number): React.CSSProperties => ({ WebkitTextStroke: `${px}px #000`, paintOrder: "stroke fill" });

const Caption: React.FC<{ t: number }> = ({ t }) => {
  const ci = CHUNKS.findIndex((x) => t >= x.from - 0.03 && t < x.to - 0.03);
  if (ci < 0) return null;
  const c = CHUNKS[ci];
  const Y: number | undefined = CAPY[c.line]; // posisi tegak per baris (plan.json captions[].y)
  let active = 0;
  c.words.forEach((w, i) => { if (t >= w.start - 0.03) active = i; });
  const isE = (w: Word) => EMPH.has(w.show);
  const all = c.words.map((w) => w.show).join(" ");
  const base: React.CSSProperties = { position: "absolute", left: 0, right: 0, textAlign: "center", fontFamily: FONT, textTransform: "uppercase", whiteSpace: "nowrap" };
  switch (c.style) {
    case "box": { // kata aktif diberi kotak gradasi brand, huruf putih (caption-highlight)
      const size = fit(all, 800, 60, SAFE, 0, c.words.length * 44);
      return (
        <div style={{ ...base, top: Y ?? 1400, fontWeight: 800, fontSize: size, lineHeight: 1.35 }}>
          {c.words.map((w, i) => {
            const on = i === active, q = on ? eo3((t - w.start + 0.03) / 0.1) : 0;
            return (
              <span key={i} style={{ position: "relative", isolation: "isolate", display: "inline-block", margin: "0 6px", padding: "2px 14px", color: "#fff",
                textShadow: on ? "0 2px 6px rgba(120,30,0,.45)" : "0 3px 10px rgba(0,0,0,.9), 0 0 3px #000", ...(on ? {} : stroke(8)) }}>
                <span style={{ position: "absolute", inset: 0, background: GRAD, borderRadius: 12, transform: `scaleX(${q}) rotate(-2deg)`, zIndex: -1, boxShadow: "0 6px 16px rgba(0,0,0,.35)" }} />{w.show}
              </span>
            );
          })}
        </div>
      );
    }
    case "slam": { // satu kata besar; tumbuh dari kecil dengan pantulan (tidak pernah lebih lebar dari layar)
      const q = backOut((t - c.from + 0.03) / 0.16), size = fit(all, 900, 170, SAFE, 0, 28);
      const tilt = [-4, 3, -2, 4][ci % 4];
      return (
        <div style={{ ...base, top: Y ?? 1150, fontWeight: 900, fontSize: size, lineHeight: 1, color: c.words.some(isE) ? ACC : "#fff", ...stroke(14),
          opacity: clamp01(q * 4), transform: `scale(${0.55 + 0.45 * q}) rotate(${tilt * (1 - clamp01(q))}deg)`, textShadow: "0 8px 24px rgba(0,0,0,.5)" }}>{all}</div>
      );
    }
    case "emph": { // ukuran kontras: kata penting besar warna brand, lainnya kecil (caption-editorial-emphasis)
      return (
        <div style={{ position: "absolute", left: 70, right: 70, top: Y ?? 1240, fontFamily: FONT, textTransform: "uppercase", display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "baseline", columnGap: 20 }}>
          {c.words.map((w, i) => {
            const q = eo3((t - w.start + 0.05) / 0.16), e = isE(w);
            const size = e ? fit(w.show, 900, 118, SAFE, 0, 16) : 54;
            return <span key={i} style={{ whiteSpace: "nowrap", opacity: q, transform: `translateY(${(1 - q) * 30}px)`, filter: `blur(${(1 - q) * 8}px)`, fontWeight: e ? 900 : 700, fontSize: size,
              color: e ? ACC : "#fff", textShadow: "0 4px 16px rgba(0,0,0,.85), 0 0 3px #000", ...stroke(e ? 9 : 7) }}>{w.show}</span>;
          })}
        </div>
      );
    }
    case "stack": // kata ditumpuk per baris dari kiri, meluncur masuk utuh (sapu/clip dilarang: terlihat terpotong)
      return (
        <div style={{ position: "absolute", left: 70, top: Y ?? 1120, fontFamily: FONT, fontWeight: 900, lineHeight: 1.04, textTransform: "uppercase" }}>
          {c.words.map((w, i) => {
            const q = eo3((t - w.start + 0.05) / 0.14);
            return <div key={i} style={{ whiteSpace: "nowrap", fontSize: fit(w.show, 900, 92, SAFE, 0, 20), opacity: q,
              color: i === active ? ACC : "#fff", ...stroke(10), transform: `translateX(${(1 - q) * -60}px) scale(${0.85 + 0.15 * q})`, transformOrigin: "0 50%" }}>{w.show}</div>;
          })}
        </div>
      );
    case "note": { // tulisan tangan Caveat huruf kecil; kata muncul utuh, kata aktif warna brand + coretan garis bawah
      const size = fitS(all.toLowerCase(), 700, 112, SAFE, c.words.length * 22);
      return (
        <div style={{ ...base, top: Y ?? 1330, fontFamily: SCRIPT, fontWeight: 700, fontSize: size, lineHeight: 1.1, textTransform: "none", transform: "rotate(-2deg)" }}>
          {c.words.map((w, i) => {
            if (t < w.start - 0.05) return <span key={i} style={{ display: "inline-block", margin: "0 11px", opacity: 0 }}>{w.show.toLowerCase()}</span>;
            const q = backOut((t - w.start + 0.05) / 0.2), on = i === active, u = on ? eo3((t - w.start) / 0.25) : 0;
            return (
              <span key={i} style={{ position: "relative", display: "inline-block", margin: "0 11px", color: on || isE(w) ? BRAND.light : "#fff",
                transform: `translateY(${(1 - q) * 26}px) scale(${0.9 + 0.1 * q})`, textShadow: "0 4px 14px rgba(0,0,0,.85), 0 0 3px rgba(0,0,0,.9)" }}>
                {w.show.toLowerCase()}
                <span style={{ position: "absolute", left: 0, right: 0, bottom: 6, height: 9, borderRadius: 9, background: GRAD, transform: `scaleX(${u}) rotate(-2deg)`, transformOrigin: "0 50%", boxShadow: "0 2px 6px rgba(0,0,0,.4)" }} />
              </span>
            );
          })}
        </div>
      );
    }
    case "typeon": { // pita brand; kata muncul UTUH saat mulai diucapkan (bukan per huruf -> tidak ada kata setengah)
      const size = fit(all, 800, 56, SAFE - 60, 2);
      return (
        <div style={{ position: "absolute", left: 0, right: 0, top: Y ?? 1420, display: "flex", justifyContent: "center" }}>
          <div style={{ background: GRAD, borderRadius: 14, padding: "14px 30px", fontFamily: FONT, fontWeight: 800, fontSize: size, color: "#fff", textTransform: "uppercase",
            letterSpacing: 2, whiteSpace: "nowrap", boxShadow: "0 8px 24px rgba(0,0,0,.35)", textShadow: "0 2px 4px rgba(120,30,0,.4)" }}>
            {c.words.map((w, i) => {
              const q = eo3((t - w.start + 0.03) / 0.08);
              if (t < w.start - 0.03) return null; // pita memanjang mengikuti kata yang sudah diucapkan
              return <span key={i} style={{ display: "inline-block", marginLeft: i ? "0.3em" : 0, transform: `translateY(${(1 - q) * 14}px)` }}>{w.show}</span>;
            })}
          </div>
        </div>
      );
    }
  }
  // karaoke (gaya lama)
  const size = fit(all, 800, 58, SAFE, 4, (c.words.length - 1) * 22 + 20);
  return (
    <div style={{ ...base, top: Y ?? 1430, fontWeight: 800, fontSize: size, lineHeight: 1.18, letterSpacing: 4 }}>
      {c.words.map((w, i) => (
        <span key={i} style={{ color: i === active ? ACC : "#fff", ...stroke(10), textShadow: "0 3px 6px rgba(0,0,0,.45)", marginRight: i < c.words.length - 1 ? 22 : 0 }}>{w.show}</span>
      ))}
    </div>
  );
};

// ---------- harga (gaya: card | count | sticker) ----------
const CARD_FROM = at(C.card.from[0] as number, C.card.from[1] as string), CARD_TO = lastEnd(C.card.toLineEnd) - 0.2;
const PSTYLE: string = C.priceStyle || "card";
const priceNum = parseInt(String(C.card.price).replace(/\./g, ""), 10);
const fmt = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const Price: React.FC<{ t: number; frame: number }> = ({ t, frame }) => {
  if (t < CARD_FROM || t > CARD_TO) return null;
  const sp = spring({ frame: frame - Math.round(CARD_FROM * FPS), fps: FPS, config: { damping: 14, stiffness: 180 } });
  const out = interpolate(t, [CARD_TO - 0.15, CARD_TO], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const count = eo3((t - CARD_FROM - 0.1) / 0.7);
  if (PSTYLE === "count") {
    // angka besar menghitung naik lalu pil "per malam" dicap (mk-progress-stat)
    const stamp = backOut((t - CARD_FROM - 0.85) / 0.2);
    return (
      <div style={{ position: "absolute", top: 380, width: "100%", textAlign: "center", fontFamily: FONT, opacity: out, transform: `scale(${0.8 + 0.2 * sp})` }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: "#fff", textShadow: tShadow, letterSpacing: 6 }}>{C.card.countLabel || "MULAI"}</div>
        <div style={{ fontSize: fit("Rp" + C.card.price, 900, 150, SAFE, 0, 30), fontWeight: 900, color: "#fff", ...stroke(12), lineHeight: 1.05, whiteSpace: "nowrap" }}><span style={{ fontSize: 70 }}>Rp</span>{fmt(priceNum * count)}</div>
        <div style={{ display: "inline-block", marginTop: 10, background: GRAD, color: "#fff", fontWeight: 800, fontSize: 46, padding: "8px 30px", borderRadius: 40,
          transform: `scale(${stamp}) rotate(-4deg)`, opacity: clamp01(stamp) }}>{C.card.priceNote}</div>
      </div>
    );
  }
  if (PSTYLE === "sticker") {
    // stiker bundar miring ditempel (spring rotasi)
    const rot = interpolate(sp, [0, 1], [-40, -10]);
    return (
      <div style={{ position: "absolute", top: 300, right: 70, width: 400, height: 400, borderRadius: "50%", background: GRAD, opacity: out, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", fontFamily: FONT, color: "#fff", transform: `scale(${sp}) rotate(${rot}deg)`, boxShadow: "0 14px 40px rgba(0,0,0,.45)", border: "8px dashed rgba(0,0,0,.25)" }}>
        <div style={{ fontSize: 34, fontWeight: 700 }}>{C.card.countLabel || "MULAI"}</div>
        <div style={{ fontSize: 50, fontWeight: 900, lineHeight: 1 }}>Rp</div>
        <div style={{ fontSize: 76, fontWeight: 900, lineHeight: 1 }}>{fmt(priceNum * count)}</div>
        <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{C.card.priceNote}</div>
      </div>
    );
  }
  if (PSTYLE === "struk") {
    // struk kasir keluar dari celah printer (rincian ala "breakdown"), baris muncul satu per satu, TOTAL = harga, cap HEMAT gradasi brand
    const MONO = "SpaceMono, monospace";
    const items: [string, string][] = C.card.items || [];
    const feed = eo3((t - CARD_FROM) / 0.5);
    const rowT = (i: number) => CARD_FROM + 0.35 + i * 0.22;
    const totT = rowT(items.length) + 0.1;
    const cnt = eo3((t - totT) / 0.6), stamp = backOut((t - totT - 0.7) / 0.22);
    const zig = "polygon(" + Array.from({ length: 25 }, (_, i) => `${(i / 24) * 100}% ${i % 2 ? 100 : "calc(100% - 14px)"}`).join(",") + ",100% 0,0 0)";
    return (
      <div style={{ position: "absolute", top: 250, left: 0, right: 0, display: "flex", justifyContent: "center", opacity: out }}>
        <div style={{ position: "absolute", top: -26, width: 700, height: 30, borderRadius: 15, background: "#2a2a2a", boxShadow: "0 6px 14px rgba(0,0,0,.5)" }} />
        <div style={{ width: 640, overflow: "hidden", height: 760 * feed }}>
          <div style={{ background: "#FFFDF7", padding: "34px 40px 44px", fontFamily: MONO, color: "#222", fontSize: 30, clipPath: zig, filter: "drop-shadow(0 10px 20px rgba(0,0,0,.35))" }}>
            <div style={{ textAlign: "center", fontSize: fit(C.card.name || "", 700, 36, 560), whiteSpace: "nowrap", letterSpacing: 2 }}>{C.card.name}</div>
            <div style={{ textAlign: "center", fontSize: 22, opacity: 0.7 }}>{C.card.receiptNote || ""}</div>
            <div style={{ borderTop: "3px dashed #999", margin: "16px 0" }} />
            {items.map(([k, v], i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", opacity: t >= rowT(i) ? 1 : 0, transform: `translateY(${t >= rowT(i) ? 0 : 10}px)`, lineHeight: 1.6 }}>
                <span>{k}</span><span style={{ color: BRAND.deep }}>{v}</span>
              </div>
            ))}
            <div style={{ borderTop: "3px dashed #999", margin: "16px 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", opacity: t >= totT ? 1 : 0 }}>
              <span style={{ fontSize: 34 }}>TOTAL</span>
              <span style={{ fontSize: fit("Rp" + C.card.price, 700, 64, 380), whiteSpace: "nowrap" }}>Rp{fmt(priceNum * cnt)}</span>
            </div>
            <div style={{ textAlign: "right", fontSize: 24, opacity: t >= totT ? 0.75 : 0 }}>{C.card.priceNote}</div>
          </div>
        </div>
        <div style={{ position: "absolute", top: 520, right: 150, transform: `scale(${2 - stamp}) rotate(-14deg)`, opacity: clamp01(stamp * 2), background: GRAD, color: "#fff",
          fontFamily: FONT, fontWeight: 900, fontSize: 64, padding: "8px 30px", borderRadius: 14, border: "5px solid #fff", boxShadow: "0 8px 20px rgba(0,0,0,.4)", letterSpacing: 4 }}>{C.card.stamp || "HEMAT"}</div>
      </div>
    );
  }
  if (PSTYLE === "ticket") {
    // tiket berdua: kertas krem + sobekan perforasi, potongan kiri gradasi brand; tulisan tangan "per malam"
    const sl = interpolate(sp, [0, 1], [-900, 0]), tilt = interpolate(sp, [0, 1], [-12, -4]);
    return (
      <div style={{ position: "absolute", top: 360, left: 90, width: 900, height: 330, opacity: out, transform: `translateX(${sl}px) rotate(${tilt}deg)`, filter: "drop-shadow(0 16px 30px rgba(0,0,0,.45))", display: "flex" }}>
        <div style={{ width: 250, background: GRAD, borderRadius: "26px 0 0 26px", display: "flex", alignItems: "center", justifyContent: "center", borderRight: "6px dashed rgba(255,255,255,.75)" }}>
          <div style={{ transform: "rotate(-90deg)", fontFamily: FONT, fontWeight: 900, fontSize: 44, color: "#fff", letterSpacing: 6, whiteSpace: "nowrap" }}>{C.card.stub || "BERDUA"}</div>
        </div>
        <div style={{ flex: 1, background: "#FFF6EA", borderRadius: "0 26px 26px 0", padding: "26px 40px", fontFamily: FONT, color: "#2a1a10", position: "relative",
          WebkitMaskImage: "radial-gradient(circle at 0 50%, transparent 26px, #000 27px)" }}>
          <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: 5, color: BRAND.deep }}>{C.card.countLabel || "MULAI"}</div>
          <div style={{ fontSize: fit("Rp" + C.card.price, 900, 118, 560), fontWeight: 900, lineHeight: 1.05, whiteSpace: "nowrap" }}><span style={{ fontSize: 56 }}>Rp</span>{fmt(priceNum * count)}</div>
          <div style={{ fontFamily: SCRIPT, fontWeight: 700, fontSize: 64, color: BRAND.deep, transform: "rotate(-3deg)", marginTop: -4, whiteSpace: "nowrap" }}>{C.card.priceNote}</div>
        </div>
      </div>
    );
  }
  const f = "Montserrat, -apple-system, sans-serif";
  return (
    <div style={{ position: "absolute", top: 330, left: 225, width: 630, background: "#fff", borderRadius: 18, boxShadow: "0 12px 40px rgba(0,0,0,.35)", fontFamily: f, color: "#161823",
      padding: "22px 22px 24px", transform: `scale(${0.85 + 0.15 * sp})`, opacity: Math.min(sp * 1.3, 1) * out, transformOrigin: "50% 30%" }}>
      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ position: "relative", width: 150, height: 150, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
          <Img src={staticFile(`foto/${C.card.photo}`)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", top: 0, left: 0, background: "#FE2C55", color: "#fff", fontSize: 19, fontWeight: 600, padding: "4px 10px", borderBottomRightRadius: 8 }}>{C.card.badge}</div>
        </div>
        <div style={{ flex: 1, paddingTop: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 30, fontWeight: 600 }}>{C.card.name}</div><div style={{ fontSize: 26, color: "#555" }}>⌃</div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
            {C.card.chips.map((x: string) => <span key={x} style={{ fontSize: 21, background: "#F1F1F2", color: "#555", padding: "5px 10px", borderRadius: 6 }}>{x}</span>)}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, background: "#F8F8F8", borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ fontSize: 22, lineHeight: 1.45 }}>
          {(C.card.notes as string[][]).map(([kind, txt]) => <div key={txt} style={{ color: kind === "green" ? "#127C7C" : "#555" }}>{kind === "green" ? "✓" : "•"} {txt}</div>)}
        </div>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
          <div style={{ fontSize: 40, fontWeight: 700 }}><span style={{ fontSize: 22 }}>Rp</span>{fmt(priceNum * count)}</div>
          <div style={{ fontSize: 19, color: "#FE2C55", marginTop: 4 }}>{C.card.priceNote}</div>
          <div style={{ marginTop: 18, background: "#FE2C55", color: "#fff", fontSize: 24, fontWeight: 600, padding: "10px 30px", borderRadius: 30 }}>{C.card.button}</div>
        </div>
      </div>
    </div>
  );
};

// ---------- ajakan: pin lokasi gaya logo brand (tetes putih + rumah) memantul, panah ke tag lokasi TikTok ----------
const CTA = C.cta ? { from: at(C.cta.line, C.cta.word), to: lastEnd(C.cta.line) + 0.2, x: C.cta.x ?? 110, y: C.cta.y ?? 1180 } : null;
const Pin: React.FC<{ t: number }> = ({ t }) => {
  if (!CTA || t < CTA.from || t > CTA.to) return null;
  const d = t - CTA.from, pop = backOut(d / 0.3), bounce = Math.abs(Math.sin(d * Math.PI * 2.4)) * 26 * clamp01(d / 0.3);
  const out = 1 - clamp01((t - (CTA.to - 0.15)) / 0.15), ring = (d * 1.4) % 1;
  return (
    <div style={{ position: "absolute", left: CTA.x, top: CTA.y, width: 150, opacity: out, transform: `scale(${pop})`, transformOrigin: "50% 100%" }}>
      <div style={{ position: "absolute", left: 75 - 70 * (0.4 + ring), top: 196 - 26 * (0.4 + ring), width: 140 * (0.4 + ring), height: 52 * (0.4 + ring), borderRadius: "50%", border: `5px solid ${BRAND.light}`, opacity: 1 - ring }} />
      <svg width="150" height="200" viewBox="0 0 150 200" style={{ transform: `translateY(${-bounce}px)`, filter: "drop-shadow(0 10px 16px rgba(0,0,0,.45))" }}>
        <path d="M75 4 C35 4 6 33 6 72 C6 118 58 166 75 192 C92 166 144 118 144 72 C144 33 115 4 75 4 Z" fill="#fff" />
        <path d="M75 40 L111 70 L111 104 L86 104 L86 86 L64 86 L64 104 L39 104 L39 70 Z" fill={BRAND.deep} />
      </svg>
      {[0, 1, 2].map((k) => (
        <svg key={k} width="60" height="34" viewBox="0 0 60 34" style={{ position: "absolute", left: 45, top: 214 + k * 30, opacity: 0.35 + 0.65 * Math.max(0, Math.sin(d * 7 - k * 0.9)) }}>
          <path d="M6 6 L30 28 L54 6" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ))}
    </div>
  );
};

// ---------- tampilan global ----------
const GRADE: Record<string, string> = {
  none: "none", warm: "sepia(.12) saturate(1.12) contrast(1.04)", cool: "saturate(1.05) hue-rotate(-6deg) contrast(1.06) brightness(1.02)",
  punchy: "contrast(1.1) saturate(1.2)", film: "contrast(1.06) saturate(.9) sepia(.08)",
};
const Grain: React.FC<{ frame: number; o: number }> = ({ frame, o }) => (
  <AbsoluteFill style={{ opacity: o, mixBlendMode: "overlay", pointerEvents: "none" }}>
    <svg width={FW} height={FH}><filter id="gr"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={frame % 17} /><feColorMatrix type="saturate" values="0" /></filter><rect width="100%" height="100%" filter="url(#gr)" /></svg>
  </AbsoluteFill>
);

// ---------- efek suara (dari ~/sfx, CC0) ----------
const SFX: Record<string, string> = C.sfxFiles || {};
const sfxEvents: { t: number; key: string; vol: number; len: number }[] = [];
SHOTS.forEach((s, i) => {
  if (i === 0) return;
  const m: Record<string, [string, number, number]> = { whipL: ["whoosh", -0.15, 0.4], whipR: ["whoosh", -0.15, 0.4], whipU: ["whoosh", -0.15, 0.4], whipD: ["whoosh", -0.15, 0.4],
    flash: ["shutter", -0.03, 0.45], zoom: ["swish", -0.2, 0.35], spin: ["swish", -0.18, 0.35], push: ["swish", -0.05, 0.3], drop: ["thud", 0.32, 0.5], iris: ["pop", 0, 0.4],
    slice: ["swish", 0, 0.3], glitch: ["glitch", -0.07, 0.25], leak: ["shimmer", -0.25, 0.25] };
  const e = m[s.in]; if (e) sfxEvents.push({ t: s.t + e[1], key: e[0], vol: e[2], len: 0.7 });
  if (s.layout === "frame") sfxEvents.push({ t: s.t + 0.2, key: "shutter", vol: 0.45, len: 0.5 });
  if (s.layout === "grid4") [0, 1, 2, 3].forEach((j) => sfxEvents.push({ t: s.t + j * 0.11, key: "pop", vol: 0.3, len: 0.3 }));
  if (s.layout === "split2" || s.layout === "split3") sfxEvents.push({ t: s.t, key: "swish", vol: 0.3, len: 0.5 });
  if (s.move === "punch") sfxEvents.push({ t: s.punchT ?? s.t, key: "thud", vol: 0.4, len: 0.4 });
});
HITS.forEach((h) => sfxEvents.push({ t: h.t, key: h.fx === "flash" ? "shutter" : "thud", vol: 0.35, len: 0.4 }));
sfxEvents.push({ t: CARD_FROM + 0.05, key: PSTYLE === "card" ? "click" : "coin", vol: 0.4, len: 0.6 });
if (CTA) sfxEvents.push({ t: CTA.from, key: "pop", vol: 0.45, len: 0.4 });
if (TSTYLE === "stamp") TITLE.forEach((_, i) => sfxEvents.push({ t: 0.08 + i * 0.3, key: "thud", vol: 0.35, len: 0.4 }));

export const Promo: React.FC = () => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const h = hitFx(t);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ transform: `translate(${h.sx}px,${h.sy}px) scale(${h.scale})`, filter: GRADE[LOOK.grade] || "none" }}>
        <Picture t={t} />
      </AbsoluteFill>
      {h.tint > 0 ? <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${ACC} 0%, transparent 65%)`, opacity: h.tint, mixBlendMode: "screen" }} /> : null}
      {LOOK.vignette ? <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0,0,0,${LOOK.vignette}) 100%)` }} /> : null}
      {LOOK.grain ? <Grain frame={frame} o={LOOK.grain} /> : null}
      <Title t={t} />
      <Price t={t} frame={frame} />
      <Caption t={t} />
      <Pin t={t} />
      {h.flash > 0 ? <AbsoluteFill style={{ background: "#fff", opacity: h.flash * 0.9 }} /> : null}
      <Audio src={staticFile("audio/vo.wav")} />
      {C.music ? <Audio src={staticFile(C.music.src)} startFrom={Math.round(C.music.offset * FPS)}
        volume={(f) => C.music.volume * interpolate(f, [0, 8, TOTAL - 30, TOTAL - 1], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} /> : null}
      {sfxEvents.filter((e) => SFX[e.key]).map((e, i) => (
        <Sequence key={i} from={Math.max(0, Math.round(e.t * FPS))} durationInFrames={Math.round(e.len * FPS)}>
          <Audio src={staticFile(`sfx/${SFX[e.key]}`)} volume={e.vol} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
