import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

const THEMES = {
  dark: {
    name: 'Dark',
    primary: '#00F5A0',
    secondary: '#00D9F5',
    accent: '#FFD60A',
    background: '#0B0E11',
    cardBg: 'rgba(21, 25, 30, 0.8)',
    border: '#2A2F3A',
    textPrimary: '#FFFFFF',
    textSecondary: '#94A3B8'
  },
  darkpro: {
    name: 'Dark Pro',
    primary: '#10B981',
    secondary: '#3B82F6',
    accent: '#F59E0B',
    background: '#09090B',
    cardBg: 'rgba(24, 24, 27, 0.9)',
    border: '#27272A',
    textPrimary: '#FAFAFA',
    textSecondary: '#A1A1AA'
  },
  midnight: {
    name: 'Midnight',
    primary: '#8B5CF6',
    secondary: '#06B6D4',
    accent: '#EC4899',
    background: '#0F0A1F',
    cardBg: 'rgba(30, 20, 50, 0.85)',
    border: '#1E1433',
    textPrimary: '#F5F3FF',
    textSecondary: '#C4B5FD'
  },
  neon: {
    name: 'Neon',
    primary: '#FF00FF',
    secondary: '#00FFFF',
    accent: '#FFFF00',
    background: '#000000',
    cardBg: 'rgba(10, 0, 20, 0.9)',
    border: '#1A0033',
    textPrimary: '#FFFFFF',
    textSecondary: '#DA70D6'
  }
};

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  const [currentTheme, setCurrentTheme] = useState(THEMES.dark);

  useEffect(() => {
    const savedTheme = localStorage.getItem('tradeai_theme') || 'dark';
    setTheme(savedTheme);
    setCurrentTheme(THEMES[savedTheme] || THEMES.dark);
    applyTheme(THEMES[savedTheme] || THEMES.dark);
  }, []);

  const changeTheme = (newTheme) => {
    if (THEMES[newTheme]) {
      setTheme(newTheme);
      setCurrentTheme(THEMES[newTheme]);
      localStorage.setItem('tradeai_theme', newTheme);
      applyTheme(THEMES[newTheme]);
    }
  };

  const applyTheme = (themeColors) => {
    const root = document.documentElement;
    root.style.setProperty('--primary', themeColors.primary);
    root.style.setProperty('--secondary', themeColors.secondary);
    root.style.setProperty('--accent', themeColors.accent);
    root.style.setProperty('--background', themeColors.background);
    root.style.setProperty('--card-bg', themeColors.cardBg);
    root.style.setProperty('--border', themeColors.border);
    root.style.setProperty('--text-primary', themeColors.textPrimary);
    root.style.setProperty('--text-secondary', themeColors.textSecondary);
    document.body.style.background = themeColors.background;
  };

  return (
    <ThemeContext.Provider value={{ theme, currentTheme, changeTheme, availableThemes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
