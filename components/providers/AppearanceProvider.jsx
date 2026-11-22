'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

export const SYSTEM_THEMES = {
  'warm-stone': {
    labelAm: 'ሞቅ ያለ ድንጋይ (Warm Stone)',
    labelEn: 'Warm Stone',
    bgClass: 'bg-stone-100',
    surfaceClass: 'bg-white',
    hex: '#f5f5f4',
    swatch: 'bg-amber-700',
    bgChip: 'bg-stone-100',
  },
  'sky-slate': {
    labelAm: 'ሰማያዊና ስሌት (Sky Slate)',
    labelEn: 'Sky Slate',
    bgClass: 'bg-sky-100',
    surfaceClass: 'bg-white',
    hex: '#e0f2fe',
    swatch: 'bg-sky-600',
    bgChip: 'bg-sky-100',
  },
  'emerald-mist': {
    labelAm: 'ኤመራልድ (Emerald Mist)',
    labelEn: 'Emerald Mist',
    bgClass: 'bg-emerald-100',
    surfaceClass: 'bg-white',
    hex: '#d1fae5',
    swatch: 'bg-emerald-600',
    bgChip: 'bg-emerald-100',
  },
};

const AppearanceContext = createContext({
  theme: 'warm-stone',
  compactMode: false,
  setAppearance: () => {},
});

function applySystemAppearance(theme, compactMode) {
  if (typeof document === 'undefined') return;
  const config = SYSTEM_THEMES[theme] || SYSTEM_THEMES['warm-stone'];
  const root = document.documentElement;

  root.dataset.theme = theme;
  root.classList.toggle('compact-ui', Boolean(compactMode));

  if (document.body) {
    document.body.dataset.theme = theme;
    document.body.classList.toggle('compact-ui', Boolean(compactMode));
    document.body.style.backgroundColor = config.hex;
  }
}

export function AppearanceProvider({ children }) {
  const [theme, setTheme] = useState('warm-stone');
  const [compactMode, setCompactMode] = useState(false);

  useEffect(() => {
    try {
      const cached = localStorage.getItem('girum_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        const savedTheme = parsed?.appearance?.theme || 'warm-stone';
        const savedCompact = Boolean(parsed?.appearance?.compactMode);
        setTheme(savedTheme);
        setCompactMode(savedCompact);
        applySystemAppearance(savedTheme, savedCompact);
      } else {
        applySystemAppearance('warm-stone', false);
      }
    } catch {
      applySystemAppearance('warm-stone', false);
    }
  }, []);

  useEffect(() => {
    applySystemAppearance(theme, compactMode);
  }, [theme, compactMode]);

  const setAppearance = useCallback((patchOrUpdater) => {
    setTheme((prevTheme) => {
      setCompactMode((prevCompact) => {
        const current = { theme: prevTheme, compactMode: prevCompact };
        const next =
          typeof patchOrUpdater === 'function'
            ? patchOrUpdater(current)
            : { ...current, ...patchOrUpdater };

        const nextTheme = next.theme || 'warm-stone';
        const nextCompact = Boolean(next.compactMode);

        try {
          const cached = localStorage.getItem('girum_settings');
          const parsed = cached ? JSON.parse(cached) : {};
          localStorage.setItem(
            'girum_settings',
            JSON.stringify({
              ...parsed,
              appearance: {
                ...(parsed.appearance || {}),
                theme: nextTheme,
                compactMode: nextCompact,
              },
            })
          );
        } catch {
          // ignore storage errors
        }

        applySystemAppearance(nextTheme, nextCompact);
        setTheme(nextTheme);
        return nextCompact;
      });
      return prevTheme;
    });
  }, []);

  return (
    <AppearanceContext.Provider value={{ theme, compactMode, setAppearance }}>
      <div
        className={`min-h-screen transition-colors duration-200 ${
          (SYSTEM_THEMES[theme] || SYSTEM_THEMES['warm-stone']).bgClass
        } ${compactMode ? 'compact-ui text-[13px]' : ''}`}
      >
        {children}
      </div>
    </AppearanceContext.Provider>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}