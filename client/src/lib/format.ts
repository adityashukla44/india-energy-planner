import i18n from '../i18n';

const nf = (digits = 0) => new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** 1,23,45,678 style grouping. */
export function fmtNum(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—';
  return nf(digits).format(n);
}

/** Splits a rupee amount into value + unit (lakh/crore) for count-up display. */
export function inrParts(n: number): { value: number; digits: number; unit: string; prefix: string } {
  const abs = Math.abs(n);
  if (abs >= 1e7) return { value: n / 1e7, digits: 2, unit: i18n.t('units.crore'), prefix: '₹' };
  if (abs >= 1e5) return { value: n / 1e5, digits: 2, unit: i18n.t('units.lakh'), prefix: '₹' };
  return { value: n, digits: 0, unit: '', prefix: '₹' };
}

/** ₹1.23 crore / ₹4.5 lakh / ₹12,345 */
export function fmtINR(n: number, opts: { compact?: boolean; digits?: number } = {}): string {
  if (!Number.isFinite(n)) return '—';
  const compact = opts.compact ?? true;
  if (!compact || Math.abs(n) < 1e5) return `₹${fmtNum(n, opts.digits ?? 0)}`;
  const p = inrParts(n);
  return `₹${fmtNum(p.value, opts.digits ?? p.digits)} ${p.unit}`;
}

/** Large counts in lakh/crore words: 7.24 crore */
export function fmtIndian(n: number, digits = 2): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${fmtNum(n / 1e7, digits)} ${i18n.t('units.crore')}`;
  if (abs >= 1e5) return `${fmtNum(n / 1e5, digits)} ${i18n.t('units.lakh')}`;
  return fmtNum(n);
}

export const fmtPct = (x: number, digits = 1) => `${fmtNum(x * 100, digits)}%`;

export const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;
export const monthShort = (m: number) => i18n.t(`months.${MONTH_KEYS[m]}`);

/** "2027-03" → "Mar 2027" in the current language. */
export function fmtYm(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${monthShort((m || 1) - 1)} ${y}`;
}
