import React from "react";
import { Composition, continueRender, delayRender, staticFile } from "remotion";
import { Promo, FPS, TOTAL } from "./Promo";

const handle = delayRender("font");
const face = new FontFace("Montserrat", `url(${staticFile("fonts/Montserrat.ttf")})`, { weight: "100 900" });
face.load().then((f) => { document.fonts.add(f); continueRender(handle); }).catch(() => continueRender(handle));

export const Root: React.FC = () => (
  <Composition id="Promo" component={Promo} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
);
