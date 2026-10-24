import { useEffect, useState } from 'react';

const SIZES = [100, 112, 125] as const;
const KEY = 'textsize';

function read(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return (SIZES as readonly number[]).includes(v) ? v : 100;
  } catch {
    return 100;
  }
}

/** Scales every rem-based size on the site (Tailwind is all rem), so layout adapts instead of breaking. */
export function TextSizeToggle({ className = '' }: { className?: string }) {
  const [size, setSize] = useState(read);

  useEffect(() => {
    document.documentElement.style.fontSize = `${size}%`;
  }, [size]);

  const next = () => {
    const n = SIZES[(SIZES.indexOf(size as (typeof SIZES)[number]) + 1) % SIZES.length]!;
    setSize(n);
    try {
      if (n === 100) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(n));
    } catch {
      /* private mode: applies for this visit only */
    }
  };
  const label = size === 100 ? 'normal' : size === 112 ? 'large' : 'largest';
  return (
    <button type="button" onClick={next} className={`btn btn-ghost min-h-10 px-3 font-bold ${className}`} aria-label={`Text size: ${label}. Click to change.`} title={`Text size: ${label}`}>
      <span aria-hidden="true">
        A<span className={size === 100 ? 'text-xs' : size === 112 ? 'text-sm' : 'text-base'}>A</span>
      </span>
    </button>
  );
}
