import React, { useEffect, useState } from "react";
import { Composition, continueRender, delayRender, staticFile } from "remotion";
import { Promo, FPS, TOTAL } from "./Promo";

// Font dimuat DI DALAM komponen (bukan di tingkat modul): delayRender di tingkat modul bisa selesai sebelum Remotion
// siap mencatatnya -> renderMedia macet "delayRender() font … not cleared" walau font sudah termuat (2026-11-24).
// Montserrat = teks utama; Caveat (tulisan tangan) = note/ticket/polaroid; Space Mono (mesin kasir) = struk; Anton/Archivo Black/Fraunces = pilihan look.font. Semua SIL OFL. Batas 20 s per font.
const FONTS: [string, string, string][] = [["Montserrat", "fonts/Montserrat.ttf", "100 900"], ["Caveat", "fonts/Caveat.ttf", "400 700"], ["SpaceMono", "fonts/SpaceMono.ttf", "700"],
  // huruf utama pilihan look.font (berkas satu ketebalan didaftarkan 100–900 agar tidak dipalsukan tebalnya)
  ["Anton", "fonts/Anton.ttf", "100 900"], ["ArchivoBlack", "fonts/ArchivoBlack.ttf", "100 900"], ["Fraunces", "fonts/Fraunces.ttf", "100 900"]];
const PromoWithFonts: React.FC = () => {
  const [handle] = useState(() => delayRender("font"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const one = (f: FontFace) => Promise.race([f.load().then((x) => { document.fonts.add(x); }), new Promise((r) => setTimeout(r, 20000))]).catch(() => {});
    Promise.all(FONTS.map(([n, u, w]) => one(new FontFace(n, `url(${staticFile(u)})`, { weight: w })))).then(() => { setReady(true); continueRender(handle); });
  }, [handle]);
  return ready ? <Promo /> : null;
};

export const Root: React.FC = () => (
  <Composition id="Promo" component={PromoWithFonts} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
);
