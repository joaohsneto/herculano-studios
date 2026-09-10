"use client";

import { useEffect, useState } from "react";

type Palette = "coral" | "indigo";
type Mode = "light" | "dark";

export function ThemeLab() {
  const [palette, setPalette] = useState<Palette>("indigo");
  const [mode, setMode] = useState<Mode>("dark");

  useEffect(() => {
    const savedPalette = (localStorage.getItem("hs-palette") as Palette | null) ?? "indigo";
    const savedMode = (localStorage.getItem("hs-mode") as Mode | null) ?? "dark";
    setPalette(savedPalette);
    setMode(savedMode);
    document.documentElement.dataset.palette = savedPalette;
    document.documentElement.dataset.mode = savedMode;
  }, []);

  function update(nextPalette: Palette, nextMode: Mode) {
    setPalette(nextPalette);
    setMode(nextMode);
    localStorage.setItem("hs-palette", nextPalette);
    localStorage.setItem("hs-mode", nextMode);
    document.documentElement.dataset.palette = nextPalette;
    document.documentElement.dataset.mode = nextMode;
  }

  return (
    <div className="theme-lab" aria-label="Seletor temporário de aparência">
      <span>Palette lab</span>
      <div className="theme-options">
        <button className={palette === "coral" ? "active" : ""} onClick={() => update("coral", mode)}>Coral</button>
        <button className={palette === "indigo" ? "active" : ""} onClick={() => update("indigo", mode)}>Indigo</button>
        <i aria-hidden="true" />
        <button className={mode === "light" ? "active" : ""} onClick={() => update(palette, "light")}>Light</button>
        <button className={mode === "dark" ? "active" : ""} onClick={() => update(palette, "dark")}>Dark</button>
      </div>
    </div>
  );
}
