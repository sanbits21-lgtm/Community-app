import type { PaletteId } from '@sangha/shared';

/** What the admin sees when choosing a colour theme. The real colours are in index.css; these are previews. */
export const PALETTES: Record<PaletteId, { name: string; note: string; /** yellow, red, page, text */ swatches: [string, string, string, string] }> = {
  turmeric: { name: 'Turmeric & kumkum', note: 'Warm and friendly. Golden yellow, deep red, cream.', swatches: ['#f2a900', '#b3261e', '#fffbf2', '#2b1d14'] },
  silk: { name: 'Mysore silk', note: 'Rich and traditional. Antique gold, maroon, ivory.', swatches: ['#c9a227', '#7b1e2b', '#fbf7ee', '#241a17'] },
  flag: { name: 'Flag accents + calm green', note: 'Modern. Mostly neutral; colour only for buttons.', swatches: ['#ffb300', '#c62828', '#fafaf7', '#1f6f5c'] },
  classic: { name: 'Classic flag', note: 'The original bright yellow and red on white.', swatches: ['#ffc20e', '#d32f2f', '#ffffff', '#1c1c1e'] },
};
export const DEFAULT_PALETTE: PaletteId = 'turmeric';

/** Sets the theme on the page. `remember` also keeps it for the next visit, so the page never flashes the old colours. */
export function applyPalette(id: PaletteId, remember = true): void {
  document.documentElement.dataset.palette = id;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', PALETTES[id].swatches[0]);
  if (!remember) return;
  try {
    localStorage.setItem('palette', id);
  } catch {
    /* private mode: it just won't be remembered */
  }
}
