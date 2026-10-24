import { PALETTE_IDS } from '@sangha/shared';
import { useEffect } from 'react';
import { applyPalette } from '../lib/palettes';
import { useSite } from './ui';

/** Keeps the page's colour theme in step with what the admin chose (public site and admin screens alike). */
export function PaletteSync() {
  const { data: site } = useSite();
  const palette = site?.palette;
  useEffect(() => {
    if (palette && (PALETTE_IDS as readonly string[]).includes(palette)) applyPalette(palette);
  }, [palette]);
  return null;
}
