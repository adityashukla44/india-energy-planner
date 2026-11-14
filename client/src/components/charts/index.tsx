import clsx from 'clsx';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LifecycleResult } from '../../engine/lifecycle';
import type { RolloutResult } from '../../engine/rollout';
import type { SimResult } from '../../engine/types';
import { fmtINR, fmtNum, fmtYm, monthShort } from '../../lib/format';
import { useThemeColors } from '../../lib/hooks';

function ChartTooltip({ active, payload, label, fmt, labelFmt }: { active?: boolean; payload?: { name: string; value: number; color: string; dataKey: string }[]; label?: string | number; fmt: (v: number) => string; labelFmt?: (l: string | number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-btn px-3 py-2 text-xs">
      <div className="mb-1 font-semibold text-text">{labelFmt ? labelFmt(label ?? '') : label}</div>
      {payload
        .filter((p) => p.value !== undefined && p.value !== null)
        .map((p) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
              {p.name}
            </span>
            <span className="num text-text">{fmt(p.value)}</span>
          </div>
        ))}
    </div>
  );
}

const axisProps = (tk: ReturnType<typeof useThemeColors>) => ({
  stroke: tk.muted,
  tick: { fill: tk.muted },
  tickLine: false,
  axisLine: { stroke: tk.tealDeep },
});

/** Monthly generation by source (stacked) vs demand (line), in MWh. */
export function MonthlyBalanceChart({ sim, className }: { sim: SimResult; className?: string }) {
  const { t } = useTranslation();
  const tk = useThemeColors();
  const data = sim.months.map((m, i) => ({
    month: monthShort(i),
    solar: +(Math.max(0, m.pv - m.curtailed) / 1000).toFixed(2),
    wind: +(m.wind / 1000).toFixed(2),
    hydro: +(m.hydro / 1000).toFixed(2),
    diesel: +(m.diesel / 1000).toFixed(2),
    demand: +(m.demand / 1000).toFixed(2),
    met: +(m.reliability * 100).toFixed(1),
  }));
  const hasWind = sim.annualWind > 0;
  const hasHydro = sim.annualHydro > 0;
  const hasDiesel = sim.annualDiesel > 0;
  return (
    <div className={clsx('h-72 w-full', className)} role="img" aria-label={t('charts.monthlyAria', { worst: monthShort(sim.worstMonth), pct: fmtNum(sim.worstReliability * 100, 1) })}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="g-solar" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={tk.amber} stopOpacity={0.95} />
              <stop offset="1" stopColor={tk.amber} stopOpacity={0.55} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={tk.tealDeep} strokeOpacity={0.35} vertical={false} />
          <XAxis dataKey="month" {...axisProps(tk)} />
          <YAxis {...axisProps(tk)} width={52} label={{ value: 'MWh', angle: -90, position: 'insideLeft', fill: tk.muted, fontSize: 11, dx: 14 }} />
          <Tooltip content={<ChartTooltip fmt={(v) => `${fmtNum(v, 2)} MWh`} />} cursor={{ fill: tk.aqua, fillOpacity: 0.06 }} />
          <Legend wrapperStyle={{ fontSize: 12, color: tk.muted }} iconType="circle" iconSize={8} />
          <Bar dataKey="solar" name={t('res.solar')} stackId="g" fill="url(#g-solar)" radius={[0, 0, 0, 0]} />
          {hasWind && <Bar dataKey="wind" name={t('res.wind')} stackId="g" fill={tk.aqua} />}
          {hasHydro && <Bar dataKey="hydro" name={t('res.hydro')} stackId="g" fill={tk.hydro} />}
          {hasDiesel && <Bar dataKey="diesel" name={t('res.diesel')} stackId="g" fill={tk.critical} radius={[3, 3, 0, 0]} />}
          <Line dataKey="demand" name={t('charts.demand')} type="monotone" stroke={tk.text} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Stacked cumulative 20-year cost with diesel-only and grid comparison lines and break-even markers. */
export function LifecycleChart({ life, className }: { life: LifecycleResult; className?: string }) {
  const { t } = useTranslation();
  const tk = useThemeColors();
  const data = life.years.map((y) => ({
    year: y.year,
    capex: y.cumCapex / 1e5,
    om: y.cumOm / 1e5,
    battery: y.cumBattery / 1e5,
    fuel: y.cumFuel / 1e5,
    total: y.cumulative / 1e5,
    diesel: y.dieselOnlyCum / 1e5,
    grid: y.gridCum / 1e5,
  }));
  const last = data[data.length - 1];
  const pbD = life.paybackVsDiesel;
  const pbG = life.paybackVsGrid;
  return (
    <div className={clsx('h-80 w-full', className)} role="img" aria-label={t('charts.lifecycleAria', { total: fmtINR(life.total20), diesel: fmtINR(life.dieselOnlyTotal20), payback: pbD ?? '—' })}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 12, right: 16, left: -4, bottom: 0 }}>
          <defs>
            {(
              [
                ['capex', tk.teal],
                ['om', tk.aqua],
                ['battery', tk.mint],
                ['fuel', tk.critical],
              ] as const
            ).map(([k, c]) => (
              <linearGradient key={k} id={`lc-${k}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={c} stopOpacity={0.75} />
                <stop offset="1" stopColor={c} stopOpacity={0.25} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid stroke={tk.tealDeep} strokeOpacity={0.35} vertical={false} />
          <XAxis dataKey="year" {...axisProps(tk)} label={{ value: t('charts.year'), position: 'insideBottomRight', fill: tk.muted, fontSize: 11, dy: 8 }} />
          <YAxis {...axisProps(tk)} width={60} tickFormatter={(v) => `${fmtNum(v, 0)}L`} />
          <Tooltip content={<ChartTooltip fmt={(v) => fmtINR(v * 1e5)} labelFmt={(l) => `${t('charts.year')} ${l}`} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          <Area type="monotone" dataKey="capex" stackId="c" name={t('charts.capex')} stroke={tk.teal} fill="url(#lc-capex)" />
          <Area type="monotone" dataKey="om" stackId="c" name={t('charts.om')} stroke={tk.aqua} fill="url(#lc-om)" />
          <Area type="monotone" dataKey="battery" stackId="c" name={t('charts.battery')} stroke={tk.mint} fill="url(#lc-battery)" />
          <Area type="monotone" dataKey="fuel" stackId="c" name={t('charts.fuel')} stroke={tk.critical} fill="url(#lc-fuel)" />
          <Line type="monotone" dataKey="diesel" name={t('charts.dieselOnly')} stroke={tk.amber} strokeWidth={2} strokeDasharray="6 4" dot={false} />
          <Line type="monotone" dataKey="grid" name={t('charts.grid')} stroke={tk.muted} strokeWidth={2} strokeDasharray="2 4" dot={false} />
          {pbD !== null && <ReferenceLine x={pbD} stroke={tk.amber} strokeOpacity={0.6} label={{ value: t('charts.breakEvenDiesel', { y: pbD }), fill: tk.amber, fontSize: 11, position: 'insideTopLeft' }} />}
          {pbG !== null && <ReferenceLine x={pbG} stroke={tk.muted} strokeOpacity={0.6} label={{ value: t('charts.breakEvenGrid', { y: pbG }), fill: tk.muted, fontSize: 11, position: 'insideTopRight' }} />}
          <ReferenceDot x={last.year} y={last.total} r={5} fill={tk.cyan} stroke={tk.bg} strokeWidth={2} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Monthly spend bars with cumulative spend line (teal area). */
export function SpendChart({ r, budget, className }: { r: RolloutResult; budget: number; className?: string }) {
  const { t } = useTranslation();
  const tk = useThemeColors();
  const data = r.months.map((m) => ({ ym: m.ym, spend: m.spend / 1e5, cumulative: m.cumulative / 1e5 }));
  const last = data[data.length - 1];
  return (
    <div className={clsx('h-64 w-full', className)} role="img" aria-label={t('charts.spendAria', { total: fmtINR(r.totalCost), months: r.months.length })}>
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 10, right: 12, left: -4, bottom: 0 }}>
          <defs>
            <linearGradient id="sp-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={tk.teal} stopOpacity={0.55} />
              <stop offset="1" stopColor={tk.teal} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={tk.tealDeep} strokeOpacity={0.35} vertical={false} />
          <XAxis dataKey="ym" {...axisProps(tk)} tickFormatter={fmtYm} minTickGap={16} />
          <YAxis yAxisId="l" {...axisProps(tk)} width={56} tickFormatter={(v) => `${fmtNum(v, 0)}L`} />
          <YAxis yAxisId="r" orientation="right" {...axisProps(tk)} width={56} tickFormatter={(v) => `${fmtNum(v, 0)}L`} />
          <Tooltip content={<ChartTooltip fmt={(v) => fmtINR(v * 1e5)} labelFmt={(l) => fmtYm(String(l))} />} />
          <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" iconSize={8} />
          <Bar yAxisId="l" dataKey="spend" name={t('charts.monthlySpend')} fill={tk.amber} radius={[4, 4, 0, 0]} maxBarSize={28} />
          <Area yAxisId="r" type="monotone" dataKey="cumulative" name={t('charts.cumulative')} stroke={tk.aqua} strokeWidth={2.5} fill="url(#sp-area)" />
          <ReferenceLine yAxisId="l" y={budget / 1e5} stroke={tk.critical} strokeDasharray="4 4" label={{ value: t('charts.budgetCap'), fill: tk.critical, fontSize: 11, position: 'insideTopLeft' }} />
          {last && <ReferenceDot yAxisId="r" x={last.ym} y={last.cumulative} r={5} fill={tk.cyan} stroke={tk.bg} strokeWidth={2} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Gantt-style schedule: one bar per phase; critical phases highlighted. */
export function GanttChart({ r, monthIndex }: { r: RolloutResult; monthIndex?: number }) {
  const { t } = useTranslation();
  const n = Math.max(1, r.months.length);
  const ticks = useMemo(() => r.months.filter((_, i) => n <= 12 || i % Math.ceil(n / 12) === 0), [r.months, n]);
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-y-1.5 text-sm">
        <caption className="sr-only">{t('rollout.ganttCaption')}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-44 text-left text-xs font-medium text-muted">
              {t('rollout.phase')}
            </th>
            <th scope="col" className="relative h-6 text-left text-xs font-medium text-muted">
              {ticks.map((m) => (
                <span key={m.ym} className="num absolute top-0 -translate-x-1/2 whitespace-nowrap text-[11px]" style={{ left: `${((m.index + 0.5) / n) * 100}%` }}>
                  {fmtYm(m.ym)}
                </span>
              ))}
            </th>
            <th scope="col" className="w-24 text-right text-xs font-medium text-muted">
              {t('rollout.cost')}
            </th>
          </tr>
        </thead>
        <tbody>
          {r.phases.map((p) => {
            const left = (p.startMonth / n) * 100;
            const width = ((p.endMonth - p.startMonth + 1) / n) * 100;
            const label = p.kind === 'homes' ? t('rollout.homesBatch', { b: p.batch, n: p.homes }) : t(`rollout.phases.${p.kind}`);
            const done = monthIndex !== undefined && monthIndex >= p.endMonth;
            const live = monthIndex !== undefined && monthIndex >= p.startMonth && monthIndex < p.endMonth;
            return (
              <tr key={p.id}>
                <th scope="row" className="pr-3 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <span className={clsx('h-2 w-2 shrink-0 rounded-full', p.critical ? 'bg-critical' : 'bg-aqua')} aria-hidden />
                    <span className="truncate">{label}</span>
                    {p.critical && p.kind !== 'survey' && <span className="sr-only">({t('rollout.critical')})</span>}
                  </span>
                </th>
                <td className="relative h-8 rounded-[8px] bg-line/15">
                  {p.startMonth >= 0 && (
                    <div
                      className={clsx(
                        'absolute inset-y-1 rounded-[6px] transition-opacity',
                        p.kind === 'survey' ? 'bg-muted/60' : p.critical ? 'bg-gradient-to-r from-critical/80 to-amber/80' : 'bg-gradient-to-r from-teal to-aqua',
                        done && 'shadow-glow',
                        monthIndex !== undefined && !done && !live && 'opacity-40',
                      )}
                      style={{ left: `${left}%`, width: `${Math.max(width, 2)}%` }}
                      title={`${label}: ${fmtYm(r.months[p.startMonth]?.ym ?? '')} → ${fmtYm(r.months[p.endMonth]?.ym ?? '')}`}
                    />
                  )}
                  {monthIndex !== undefined && (
                    <div className="pointer-events-none absolute -inset-y-1 w-0.5 bg-cyan shadow-glow" style={{ left: `${((monthIndex + 0.5) / n) * 100}%` }} aria-hidden />
                  )}
                </td>
                <td className="num pl-3 text-right text-xs text-muted">{fmtINR(p.cost)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
