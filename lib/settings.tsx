"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type ColorTheme = "dark_gold" | "dark_crimson" | "dark_forest" | "midnight";
export type CardSize = "small" | "medium" | "large";
export type AnimationLevel = "full" | "reduced" | "minimal";

export interface GameSettings {
  colorTheme: ColorTheme;
  cardSize: CardSize;
  animationLevel: AnimationLevel;
  musicVolume: number;
  sfxVolume: number;
}

const DEFAULT_SETTINGS: GameSettings = {
  colorTheme: "dark_gold",
  cardSize: "medium",
  animationLevel: "full",
  musicVolume: 70,
  sfxVolume: 80,
};

interface SettingsContextValue {
  settings: GameSettings;
  updateSetting: <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSetting: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("tryllepap_settings");
      if (saved) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
    } catch {}
  }, []);

  useEffect(() => {
    const themes: Record<ColorTheme, Record<string, string>> = {
      dark_gold: {
        "--gold": "#c9923a",
        "--gold-light": "#e8b96a",
        "--crimson": "#8b1a1a",
        "--surface": "#1a1410",
        "--surface-2": "#221c15",
        "--border-gold": "#6b4f1e",
      },
      dark_crimson: {
        "--gold": "#c93a3a",
        "--gold-light": "#e87070",
        "--crimson": "#6b0f0f",
        "--surface": "#1a1010",
        "--surface-2": "#221515",
        "--border-gold": "#6b1e1e",
      },
      dark_forest: {
        "--gold": "#3a9a5c",
        "--gold-light": "#6abf8a",
        "--crimson": "#1a4a2a",
        "--surface": "#101a12",
        "--surface-2": "#152215",
        "--border-gold": "#1e5c2a",
      },
      midnight: {
        "--gold": "#5a7adf",
        "--gold-light": "#8aaaf5",
        "--crimson": "#2a1a6b",
        "--surface": "#10101a",
        "--surface-2": "#151522",
        "--border-gold": "#2a2a7a",
      },
    };
    const vars = themes[settings.colorTheme];
    Object.entries(vars).forEach(([k, v]) => {
      document.documentElement.style.setProperty(k, v);
    });
  }, [settings.colorTheme]);

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      try { localStorage.setItem("tryllepap_settings", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
