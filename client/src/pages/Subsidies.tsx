import { AlertTriangle, ExternalLink, Info, Landmark, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Container, PageHeader } from '../components/layout/Layout';
import { Badge, Card, CardTitle, EmptyState, NumberField, Skeleton, Tile, Toggle } from '../components/ui';
import { matchSchemes, totalSubsidy, type ProjectType, type SubsidiesFile } from '../engine/subsidy';
import { loadJson, useCostParams, useData } from '../lib/data';
import { fmtINR, fmtNum, inrParts } from '../lib/format';
import { usePlan } from '../lib/hooks';

const TYPES: ProjectType[] = ['home_rooftop', 'home_offgrid', 'rwa', 'solar_pump', 'farm_plant', 'feeder', 'village_microgrid'];

export default function Subsidies() {
  const { t } = useTranslation();
  const { districts } = useData();
  const costs = useCostParams();
  const { district, active } = usePlan();
  const [file, setFile] = useState<SubsidiesFile | null>(null);
  const [err, setErr] = useState(false);
  const [allStates, setAllStates] = useState<string[]>([]);
  useEffect(() => {
    loadJson<{ states: { state: string }[] }>('helplines.json').then((h) => setAllStates(h.states.map((s) => s.state)), () => {});
  }, []);
  const states = useMemo(() => (allStates.length ? allStates : [...new Set(districts.map((d) => d.state))].sort()), [allStates, districts]);
  const [state, setState] = useState<string>(district?.state ?? 'Delhi');
  const [type, setType] = useState<ProjectType>('home_rooftop');
  const [kw, setKw] = useState(3);
  const [houses, setHouses] = useState(20);
  const [hp, setHp] = useState(5);
  const [grid, setGrid] = useState(true);
  const [cost, setCost] = useState<number | null>(null);
  useEffect(() => {
    loadJson<SubsidiesFile>('subsidies.json').then(setFile, () => setErr(true));
  }, []);
  useEffect(() => {
    if (district) setState(district.state);
  }, [district]);
  const solar = costs?.solar_capex_per_kw ?? 55000;
  const autoCost = type === 'solar_pump' ? hp * 0.746 * 1.4 * solar : kw * solar;
  const projectCost = cost ?? autoCost;
  const inputs = { state, type, kw, projectCost, houses, pumpHp: hp, gridConnected: type === 'home_offgrid' ? false : grid };
  const matches = useMemo(() => (file ? matchSchemes(file.schemes, inputs) : []), [file, state, type, kw, projectCost, houses, hp, grid]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = totalSubsidy(matches, projectCost);
  const useDesign = () => {
    if (!active) return;
    setType('village_microgrid');
    setKw(Math.round(active.spec.pvKwp * 10) / 10);
    setCost(Math.round(active.life.capex.total));
  };
  const net = inrParts(Math.max(0, projectCost - total));
  const sub = inrParts(total);
  return (
    <>
      <PageHeader eyebrow={t('subsidies.eyebrow')} title={t('subsidies.title')} sub={t('subsidies.sub')} />
      <Container className="mt-6 grid gap-6 lg:grid-cols-12">
        <Card className="h-fit lg:col-span-4">
          <CardTitle icon={<Landmark size={18} />}>{t('subsidies.project')}</CardTitle>
          <div className="space-y-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              {t('subsidies.state')}
              <select className="field" value={state} onChange={(e) => setState(e.target.value)}>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              {t('subsidies.type')}
              <select className="field" value={type} onChange={(e) => setType(e.target.value as ProjectType)}>
                {TYPES.map((x) => <option key={x} value={x}>{t(`subsidies.types.${x}`)}</option>)}
              </select>
            </label>
            {type === 'solar_pump' ? (
              <NumberField label={t('subsidies.hp')} value={hp} min={0.5} max={50} step={0.5} unit="HP" onChange={setHp} />
            ) : (
              <NumberField label={t('subsidies.kw')} value={kw} min={0} max={5000} step={0.5} unit="kW" onChange={setKw} />
            )}
            {type === 'rwa' && <NumberField label={t('subsidies.houses')} value={houses} min={1} max={10000} onChange={setHouses} />}
            {type !== 'home_offgrid' && <Toggle checked={grid} onChange={setGrid} label={t('subsidies.grid')} />}
            <NumberField label={t('subsidies.cost')} value={Math.round(projectCost)} min={0} max={1e10} step={5000} unit="₹" onChange={(v) => setCost(v)} />
            <p className="-mt-2 text-xs text-muted">{cost === null ? t('subsidies.costAuto', { v: fmtINR(solar, { compact: false }) }) : <button className="text-aqua hover:underline" onClick={() => setCost(null)}>{t('subsidies.costReset')}</button>}</p>
            {active && district && (
              <button className="btn-ghost w-full" onClick={useDesign}>
                <Wand2 size={16} aria-hidden /> {t('subsidies.useDesign', { name: district.name })}
              </button>
            )}
          </div>
        </Card>
        <div className="space-y-4 lg:col-span-8">
          <div className="grid grid-cols-2 gap-4">
            <Tile label={t('subsidies.tiles.total')} prefix="₹" value={sub.value} digits={sub.digits} unit={sub.unit} accent="mint" sub={t('subsidies.tiles.totalSub')} />
            <Tile label={t('subsidies.tiles.net')} prefix="₹" value={net.value} digits={net.digits} unit={net.unit} accent="amber" sub={t('subsidies.tiles.netSub', { cost: fmtINR(projectCost) })} />
          </div>
          {file?.openQuestions.map((q) => (
            <Card key={q} className="flex items-start gap-3 border-amber/40 text-sm">
              <Info size={18} className="mt-0.5 shrink-0 text-amber" aria-hidden /> <span>{t('subsidies.openQuestion')}</span>
            </Card>
          ))}
          {err && <Card><EmptyState title={t('errors.dataTitle')} body={t('errors.dataBody')} /></Card>}
          {!file && !err && <Skeleton className="h-64" />}
          {file && matches.length === 0 && (
            <Card><EmptyState icon={<Landmark aria-hidden />} title={t('subsidies.none')} body={t(type === 'home_offgrid' ? 'subsidies.noneOffgrid' : 'subsidies.noneBody')} /></Card>
          )}
          {matches.map((m) => (
            <Card key={m.scheme.id} className={m.eligible ? '' : 'opacity-75'}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-base font-semibold">{m.scheme.name}</h3>
                  <p className="text-xs text-muted">{m.scheme.authority}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {m.scheme.status === 'transition' ? <Badge tone="amber">{t('subsidies.transition')}</Badge> : <Badge tone="mint">{t('subsidies.active')}</Badge>}
                  {!m.eligible && <Badge tone="critical">{t('subsidies.notEligible')}</Badge>}
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
                <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                  {m.scheme.rules.map((r) => <li key={r}>{r}</li>)}
                </ul>
                <div className="text-left sm:text-right">
                  <p className="text-xs text-muted">{t('subsidies.estimate')}</p>
                  <p className="num font-display text-xl font-extrabold text-mint">{m.amount > 0 ? fmtINR(m.amount) : '—'}</p>
                  {m.amount > 0 && <p className="text-xs text-muted">{t('subsidies.ofCost', { pct: fmtNum((m.amount / Math.max(1, projectCost)) * 100, 0) })}</p>}
                </div>
              </div>
              {m.reasonKey && (
                <p className="mt-3 flex items-start gap-2 text-xs text-warning">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden /> {t(m.reasonKey)}
                </p>
              )}
              {m.scheme.status === 'transition' && <p className="mt-2 text-xs text-muted">{t('subsidies.transitionNote')}</p>}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/25 pt-3">
                <p className="flex items-center gap-2 text-xs font-medium text-amber">
                  <AlertTriangle size={14} aria-hidden /> {t('subsidies.verify')}
                </p>
                <a href={m.scheme.url} target="_blank" rel="noreferrer" className="btn-ghost min-h-[40px] text-xs">
                  {t('subsidies.official')} <ExternalLink size={13} aria-hidden />
                </a>
              </div>
            </Card>
          ))}
        </div>
      </Container>
    </>
  );
}
