import { AlertTriangle, CalendarRange, CheckCircle2, MapPin, Pause, Play } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { GanttChart, SpendChart } from '../components/charts';
import { Container, PageHeader } from '../components/layout/Layout';
import { DistrictGate, useOptionName } from '../components/planner';
import { Card, CardTitle, IllustrativeBadge, NumberField, Skeleton, Slider, Tile } from '../components/ui';
import { planRollout, progressAt, SURVEY_SHARE, type RolloutResult } from '../engine/rollout';
import { mean } from '../engine/resource';
import type { LoadKind } from '../engine/types';
import { fmtINR, fmtNum, fmtYm, inrParts } from '../lib/format';
import { useDebounced, usePlan } from '../lib/hooks';
import { useAppStore } from '../store/useAppStore';
import type { BuildState } from '../three/SystemScene';

const SystemScene = lazy(() => import('../three/SystemScene'));

function buildAt(r: RolloutResult, month: number): BuildState {
  const p = progressAt(r, month);
  const build = r.phases.filter((x) => x.kind !== 'survey');
  const buildCost = build.reduce((s, x) => s + x.cost, 0);
  const gen = buildCost > 0 ? build.reduce((s, x) => s + x.cost * p[x.id], 0) / buildCost : 0;
  const homes = r.phases.filter((x) => x.kind === 'homes');
  const totalHomes = homes.reduce((s, x) => s + (x.homes ?? 0), 0);
  const homesDone = homes.reduce((s, x) => s + (p[x.id] >= 1 ? x.homes ?? 0 : 0), 0);
  const loads: Partial<Record<LoadKind, number>> = {};
  for (const x of r.phases) if (x.kind !== 'survey' && x.kind !== 'homes') loads[x.kind] = p[x.id];
  return { gen, loads, homes: totalHomes > 0 ? homesDone / totalHomes : 0 };
}

function RolloutBody() {
  const { t } = useTranslation();
  const { district, plan, active } = usePlan();
  const name = useOptionName();
  const inputs = useAppStore((s) => s.rollout);
  const setInputs = useAppStore((s) => s.setRollout);
  const homeTier = useAppStore((s) => s.demand.homeTier);
  const dInputs = useDebounced(inputs, 120);
  const r = useMemo(() => (plan && active ? planRollout(active.life.capex.total, plan.demand, { homeTier }, dInputs) : null), [plan, active, homeTier, dInputs]);
  const [month, setMonth] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = Math.max(0, (r?.months.length ?? 1) - 1);
  useEffect(() => setMonth((m) => Math.min(m, last)), [last]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => setMonth((m) => Math.min(last, m + 1)), 700);
    return () => window.clearInterval(id);
  }, [playing, last]);
  useEffect(() => {
    if (playing && month >= last) setPlaying(false);
  }, [playing, month, last]);
  if (!district || !plan || !active || !r) return null;
  const total = inrParts(r.totalCost);
  const critical = r.phases.filter((p) => p.critical && p.kind !== 'survey');
  const criticalEnd = critical.length ? Math.max(...critical.map((p) => p.endMonth)) : -1;
  const build = buildAt(r, month);
  const need = inrParts(r.budgetNeeded);
  return (
    <>
      <PageHeader
        eyebrow={t('rollout.eyebrow')}
        title={t('rollout.title', { name: district.name })}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {t('rollout.sub', { option: name(active.id) })} {district.illustrative && <IllustrativeBadge />}
          </span>
        }
        right={
          <Link to="/map" className="btn-ghost">
            <MapPin size={16} aria-hidden /> {t('planner.change')}
          </Link>
        }
      />
      <Container className="mt-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile label={t('rollout.tiles.total')} prefix="₹" value={total.value} digits={total.digits} unit={total.unit} accent="amber" sub={t('rollout.tiles.totalSub', { pct: SURVEY_SHARE * 100 })} />
          <Tile
            label={t('rollout.tiles.months')}
            value={Number.isFinite(r.monthsNeeded) ? r.monthsNeeded : 0}
            unit={t('rollout.tiles.monthsUnit', { n: inputs.monthsAvailable })}
            accent={r.feasible ? 'mint' : 'critical'}
            sub={r.feasible ? t('rollout.tiles.onTime') : t('rollout.tiles.late')}
          />
          <Tile label={t('rollout.tiles.budgetNeeded')} prefix="₹" value={need.value} digits={need.digits} unit={need.unit} sub={t('rollout.tiles.budgetNeededSub', { n: inputs.monthsAvailable })} />
          <Tile
            label={t('rollout.tiles.critical')}
            accent="critical"
            icon={<CheckCircle2 size={18} />}
          >
            <p className="font-display text-xl font-extrabold leading-none text-critical">{criticalEnd >= 0 ? fmtYm(r.months[criticalEnd].ym) : '—'}</p>
            <p className="text-xs text-muted">{t('rollout.tiles.criticalSub')}</p>
          </Tile>
        </div>

        {!r.feasible && (
          <Card role="alert" className="flex items-start gap-3 border-critical/50">
            <AlertTriangle className="mt-0.5 shrink-0 text-critical" aria-hidden />
            <p className="text-sm">
              {Number.isFinite(r.monthsNeeded)
                ? t('rollout.infeasible', { needed: r.monthsNeeded, available: inputs.monthsAvailable, budget: fmtINR(r.budgetNeeded) })
                : t('rollout.noBudget')}
            </p>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="lg:col-span-4">
            <CardTitle icon={<CalendarRange size={18} />}>{t('rollout.inputs')}</CardTitle>
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="start-month" className="text-xs font-medium text-muted">
                  {t('rollout.start')}
                </label>
                <input id="start-month" type="month" className="field" value={inputs.startMonth} onChange={(e) => e.target.value && setInputs({ startMonth: e.target.value })} />
              </div>
              <Slider label={t('rollout.monthsAvailable')} value={inputs.monthsAvailable} min={3} max={36} step={1} onChange={(v) => setInputs({ monthsAvailable: v })} format={(v) => t('rollout.monthsN', { n: v })} />
              <Slider
                label={t('rollout.budget')}
                value={inputs.monthlyBudget}
                min={100000}
                max={10000000}
                step={50000}
                onChange={(v) => setInputs({ monthlyBudget: v })}
                format={(v) => `${fmtINR(v)} / ${t('units.mo')}`}
              />
              <NumberField label={t('rollout.batch')} value={inputs.homesPerBatch} min={5} max={500} step={5} onChange={(v) => setInputs({ homesPerBatch: v })} />
              <p className="text-xs text-muted">{t('rollout.note')}</p>
            </div>
          </Card>
          <Card className="lg:col-span-8">
            <CardTitle>{t('rollout.gantt')}</CardTitle>
            {r.months.length ? <GanttChart r={r} monthIndex={month} /> : <Skeleton className="h-40" />}
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-5 rounded-sm bg-gradient-to-r from-critical/80 to-amber/80" /> {t('rollout.legendCritical')}
              </span>
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-5 rounded-sm bg-gradient-to-r from-teal to-aqua" /> {t('rollout.legendHomes')}
              </span>
            </div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-12">
          <Card pad={false} className="overflow-hidden lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 pb-2">
              <h2 className="font-display text-base font-semibold">{t('rollout.buildUp')}</h2>
              <span className="num text-sm text-aqua">{r.months[month] ? fmtYm(r.months[month].ym) : '—'}</span>
            </div>
            <Suspense fallback={<Skeleton className="m-4 h-[380px]" />}>
              <SystemScene
                spec={active.spec}
                demand={plan.demand}
                night={false}
                windMean={mean(district.wind50m_monthly)}
                build={build}
                className="h-[380px] rounded-none"
                label={t('rollout.sceneAria', { month: r.months[month] ? fmtYm(r.months[month].ym) : '', pct: fmtNum(build.gen * 100, 0) })}
              />
            </Suspense>
            <div className="flex items-center gap-3 border-t border-line/30 p-4">
              <button
                className="btn-secondary h-11 w-11 shrink-0 p-0"
                onClick={() => {
                  if (month >= last) setMonth(0);
                  setPlaying((p) => !p);
                }}
                aria-label={playing ? t('rollout.pause') : t('rollout.play')}
              >
                {playing ? <Pause size={18} /> : <Play size={18} />}
              </button>
              <div className="flex-1">
                <Slider
                  label={t('rollout.scrub')}
                  value={month}
                  min={0}
                  max={last}
                  step={1}
                  onChange={(v) => {
                    setPlaying(false);
                    setMonth(v);
                  }}
                  format={(v) => (r.months[v] ? fmtYm(r.months[v].ym) : '—')}
                />
              </div>
            </div>
          </Card>
          <Card className="flex flex-col lg:col-span-5">
            <CardTitle>{t('rollout.spend')}</CardTitle>
            <div className="min-h-[16rem] flex-1">{r.months.length ? <SpendChart r={r} budget={inputs.monthlyBudget} className="!h-full" /> : <Skeleton className="h-64" />}</div>
          </Card>
        </div>
      </Container>
    </>
  );
}

export default function Rollout() {
  return (
    <DistrictGate>
      <RolloutBody />
    </DistrictGate>
  );
}
