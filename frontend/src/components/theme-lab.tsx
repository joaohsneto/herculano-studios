"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("hs-theme-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("hs-theme-change", callback);
    window.removeEventListener("storage", callback);
  };
}

export function ThemeLab() {
  const mode = useSyncExternalStore(subscribe, () => document.documentElement.dataset.mode ?? "dark", () => "dark");
  function update(nextMode: "light" | "dark") {
    document.documentElement.dataset.mode = nextMode;
    try { localStorage.setItem("hs-mode", nextMode); } catch {}
    window.dispatchEvent(new Event("hs-theme-change"));
  }
  return <div className="theme-lab" aria-label="Aparência">
    <span>Aparência</span><div className="theme-options">
      <button type="button" aria-pressed={mode === "light"} className={mode === "light" ? "active" : ""} onClick={() => update("light")}>Claro</button>
      <button type="button" aria-pressed={mode === "dark"} className={mode === "dark" ? "active" : ""} onClick={() => update("dark")}>Escuro</button>
    </div>
  </div>;
}
