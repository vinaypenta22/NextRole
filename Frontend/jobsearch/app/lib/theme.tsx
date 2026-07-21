"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

export type ThemeMode = "light" | "dark";
export type ThemeLayout = "normal" | "glass";
export type AccentColor = "emerald" | "amber" | "blue" | "indigo" | "rose";

type ThemeState = {
  mode: ThemeMode;
  layout: ThemeLayout;
  accent: AccentColor;
  setMode: (mode: ThemeMode) => void;
  setLayout: (layout: ThemeLayout) => void;
  setAccent: (accent: AccentColor) => void;
};

const ThemeContext = createContext<ThemeState>({
  mode: "light",
  layout: "normal",
  accent: "blue",
  setMode: () => {},
  setLayout: () => {},
  setAccent: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

const ALL_ACCENTS: AccentColor[] = ["emerald", "amber", "blue", "indigo", "rose"];

function applyClasses(mode: ThemeMode, layout: ThemeLayout, accent: AccentColor) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.classList.toggle("glass", layout === "glass");
  ALL_ACCENTS.forEach((a) => root.classList.remove(`accent-${a}`));
  root.classList.add(`accent-${accent}`);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<{
    mode: ThemeMode;
    layout: ThemeLayout;
    accent: AccentColor;
  }>({
    mode: "light",
    layout: "normal",
    accent: "blue",
  });

  // Hydrate from localStorage on first mount
  useEffect(() => {
    const savedMode = (localStorage.getItem("tal-theme-mode") as ThemeMode) || "light";
    const savedLayout = (localStorage.getItem("tal-theme-layout") as ThemeLayout) || "normal";
    const savedAccent = "blue";
    setTheme({ mode: savedMode, layout: savedLayout, accent: savedAccent });
  }, []);

  // Sync classes whenever theme changes
  useEffect(() => {
    applyClasses(theme.mode, theme.layout, theme.accent);
  }, [theme.mode, theme.layout, theme.accent]);

  function setMode(newMode: ThemeMode) {
    setTheme((prev) => {
      localStorage.setItem("tal-theme-mode", newMode);
      return { ...prev, mode: newMode };
    });
  }

  function setLayout(newLayout: ThemeLayout) {
    setTheme((prev) => {
      localStorage.setItem("tal-theme-layout", newLayout);
      return { ...prev, layout: newLayout };
    });
  }

  function setAccent(newAccent: AccentColor) {
    setTheme((prev) => {
      localStorage.setItem("tal-theme-accent", newAccent);
      return { ...prev, accent: newAccent };
    });
  }

  return (
    <ThemeContext.Provider
      value={{
        mode: theme.mode,
        layout: theme.layout,
        accent: theme.accent,
        setMode,
        setLayout,
        setAccent,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
