import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PALETTE_IDS, siteSettingsInput } from '@sangha/shared';
import { describe, expect, it } from 'vitest';

/**
 * Reads the real stylesheet and checks every colour theme in light and dark for readability (WCAG AA).
 * If you change a colour in apps/web/src/index.css and make text hard to read, this fails and says which pair.
 */
const css = readFileSync(path.resolve(__dirname, '../../web/src/index.css'), 'utf8');

function vars(selector: string): Record<string, string> {
  // The default theme's selector appears in more than one block (e.g. the --on-yellow one), so read every match.
  const re = new RegExp('^\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'gm');
  const blocks = [...css.matchAll(re)];
  if (!blocks.length) throw new Error('theme block not found in index.css: ' + selector);
  return Object.fromEntries(blocks.flatMap((b) => [...b[1]!.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map((m) => [m[1]!, m[2]!.toLowerCase()])));
}

/** What the page really uses: the default theme's values, overridden by the chosen theme's, light then dark. */
function effective(id: string, mode: 'light' | 'dark'): Record<string, string> {
  const out: Record<string, string> = { ...vars(':root') };
  if (mode === 'dark') Object.assign(out, vars(":root[data-theme='dark']"));
  if (id !== 'turmeric') {
    Object.assign(out, vars(`:root[data-palette='${id}']`));
    if (mode === 'dark') Object.assign(out, vars(`:root[data-palette='${id}'][data-theme='dark']`));
  }
  return out;
}

const lum = (h: string) => {
  const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

describe('colour themes', () => {
  it('has exactly the themes the admin can choose, and the setting only accepts those', () => {
    expect([...PALETTE_IDS].sort()).toEqual(['classic', 'flag', 'silk', 'turmeric']);
    expect(siteSettingsInput.parse({}).palette).toBe('turmeric');
    expect(siteSettingsInput.safeParse({ palette: 'neon' }).success).toBe(false);
    for (const id of PALETTE_IDS) expect(css, id).toContain(id === 'turmeric' ? ':root {' : `[data-palette='${id}']`);
  });

  for (const id of PALETTE_IDS) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${id} (${mode}): text, buttons and links are readable`, () => {
        const t = effective(id, mode);
        const must = (name: string, fg: string, bg: string, min: number) => expect(ratio(t[fg]!, t[bg]!), `${id}/${mode}: ${name}`).toBeGreaterThanOrEqual(min);
        for (const bg of ['paper', 'card', 'soft']) {
          must(`body text on ${bg}`, 'ink', bg, 4.5);
          must(`secondary text on ${bg}`, 'muted', bg, 4.5);
          must(`red link/price text on ${bg}`, 'accent', bg, 4.5);
        }
        expect(ratio('#1c1c1e', t.yellow!), `${id}/${mode}: dark text on yellow`).toBeGreaterThanOrEqual(4.5);
        expect(ratio('#ffffff', t.red!), `${id}/${mode}: white text on red button`).toBeGreaterThanOrEqual(4.5);
        expect(ratio('#ffffff', t.done!), `${id}/${mode}: white on "step done"`).toBeGreaterThanOrEqual(4.5);
        must('red button against the page', 'red', 'paper', 3);
        must('"step done" against the page', 'done', 'paper', 3);
      });
    }
  }
});
