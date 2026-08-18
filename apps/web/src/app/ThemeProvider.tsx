import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = Exclude<Theme, 'system'>;

const THEME_STORAGE_KEY = 'zelare-theme';
const DEFAULT_THEME: Theme = 'dark';

type ThemeContextValue = {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'dark';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME;

  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'dark' || stored === 'light' || stored === 'system'
    ? stored
    : DEFAULT_THEME;
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme);

  const resolvedTheme: ResolvedTheme = theme === 'system' ? systemTheme : theme;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? 'dark' : 'light');
    };

    setSystemTheme(mediaQuery.matches ? 'dark' : 'light');
    mediaQuery.addEventListener?.('change', handleChange);

    return () => mediaQuery.removeEventListener?.('change', handleChange);
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme);
  }, [resolvedTheme]);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  };

  const toggleTheme = () => {
    const current = resolvedTheme;
    setTheme(current === 'dark' ? 'light' : 'dark');
  };

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider');
  }

  return context;
}
