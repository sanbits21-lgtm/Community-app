const fmt = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });

/** €25.00 style, whatever language the page is in (euro formatting is the same for Luxembourg readers). */
export const eur = (n: number): string => fmt.format(n);
