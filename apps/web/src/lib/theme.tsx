import { useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';
const ORDER: ThemeChoice[] = ['system', 'light', 'dark'];
const KEY = 'theme';

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** "system" removes the attribute so the prefers-color-scheme media query decides. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', choice);
}

const ICON: Record<ThemeChoice, string> = { system: '🖥️', light: '☀️', dark: '🌙' };
const LABEL: Record<ThemeChoice, string> = { system: 'Theme: match device', light: 'Theme: light', dark: 'Theme: dark' };

/** Cycles device → light → dark. The choice is remembered on this device only. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>(read);

  useEffect(() => {
    applyTheme(choice);
  }, [choice]);

  const next = () => {
    const n = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length]!;
    setChoice(n);
    try {
      if (n === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, n);
    } catch {
      /* private mode: applies for this visit only */
    }
  };

  return (
    <button type="button" onClick={next} className={`btn btn-ghost min-h-10 px-3 text-lg ${className}`} aria-label={`${LABEL[choice]}. Click to change.`} title={LABEL[choice]}>
      <span aria-hidden="true">{ICON[choice]}</span>
    </button>
  );
}
