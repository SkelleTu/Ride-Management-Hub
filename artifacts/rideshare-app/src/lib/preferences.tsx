import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type FontSize = "normal" | "large" | "xlarge";
export type Theme = "dark" | "light";

interface PreferencesState {
  fontSize: FontSize;
  setFontSize: (s: FontSize) => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const PreferencesContext = createContext<PreferencesState | undefined>(undefined);

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => load("pref_fontSize", "normal"));
  const [highContrast, setHighContrastState] = useState<boolean>(() => load("pref_highContrast", false));
  const [theme, setThemeState] = useState<Theme>(() => load("pref_theme", "dark"));

  const setFontSize = (s: FontSize) => {
    localStorage.setItem("pref_fontSize", JSON.stringify(s));
    setFontSizeState(s);
  };
  const setHighContrast = (v: boolean) => {
    localStorage.setItem("pref_highContrast", JSON.stringify(v));
    setHighContrastState(v);
  };
  const setTheme = (t: Theme) => {
    localStorage.setItem("pref_theme", JSON.stringify(t));
    setThemeState(t);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("font-large", "font-xlarge");
    if (fontSize === "large") root.classList.add("font-large");
    if (fontSize === "xlarge") root.classList.add("font-xlarge");
  }, [fontSize]);

  useEffect(() => {
    const root = document.documentElement;
    if (highContrast) root.classList.add("high-contrast");
    else root.classList.remove("high-contrast");
  }, [highContrast]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
  }, [theme]);

  return (
    <PreferencesContext.Provider value={{ fontSize, setFontSize, highContrast, setHighContrast, theme, setTheme }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
