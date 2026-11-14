import clsx from 'clsx';
import { ArrowDown, ArrowUp, Gauge } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Container, PageHeader } from '../components/layout/Layout';
import { OptionIcons, useOptionName } from '../components/planner';
import { AssumptionBadge, Badge, Card, CardTitle, RingGauge, Skeleton, Tile } from '../components/ui';
import type { ImpactScore } from '../engine/impact';
import { useData } from '../lib/data';
import { fmtINR, fmtIndian, fmtNum } from '../lib/format';
import { useImpactScores } from '../lib/hooks';
import { useAppStore } from '../store/useAppStore';

type SortKey = 'score' | 'co2AvoidedT' | 'dieselSavedL' | 'homesPerCrore' | 'lcoe' | 'name';

function CompareCol({ s, name, state }: { s: ImpactScore; name: string; state: string }) {
  const { t } = useTranslation();
  const optionName = useOptionName();
  const parts: [string, number][] = [
    [t('impact.parts.co2'), s.parts.co2],
    [t('impact.parts.diesel'), s.parts.diesel],
    [t('impact.parts.homes'), s.parts.homes],
    [t('impact.parts.cost'), s.parts.cost],
  ];
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <RingGauge value={s.score / 100} label={t('impact.scoreAria', { name, score: fmtNum(s.score, 0) })} size={120} color="rgb(var(--aqua))">
        <span className="font-display text-xl font-extrabold">{fmtNum(s.score, 0)}</span>
      </RingGauge>
      <div>
        <p className="font-display font-semibold">{name}</p>
        <p className="text-xs text-muted">{state}</p>
      </div>
      <dl className="w-full space-y-2 text-left text-sm">
        {parts.map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs">
              <dt className="text-muted">{k}</dt>
              <dd className="num">{fmtNum(v * 100, 0)}</dd>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-line/30">
              <div className="h-full rounded-full bg-aqua" style={{ width: `${Math.max(2, v * 100)}%` }} />
            </div>
          </div>
        ))}
      </dl>
      <dl className="grid w-full grid-cols-2 gap-2 text-left text-xs">
        <div><dt className="text-muted">{t('impact.cols.co2')}</dt><dd className="num text-sm font-semibold">{fmtNum(s.co2AvoidedT, 0)} t</dd></div>
        <div><dt className="text-muted">{t('impact.cols.diesel')}</dt><dd className="num text-sm font-semibold">{fmtIndian(s.dieselSavedL)} L</dd></div>
        <div><dt className="text-muted">{t('impact.cols.homes')}</dt><dd className="num text-sm font-semibold">{fmtNum(s.homesPerCrore, 0)}</dd></div>
        <div><dt className="text-muted">{t('impact.cols.lcoe')}</dt><dd className="num text-sm font-semibold">₹{fmtNum(s.lcoe, 2)}</dd></div>
      </dl>
      {s.recommended && (
        <p className="flex items-center gap-2 text-xs text-muted">
          <OptionIcons id={s.recommended} size={14} /> {optionName(s.recommended)}
        </p>
      )}
    </div>
  );
}

export default function Impact() {
  const { t } = useTranslation();
  const { districts } = useData();
  const scores = useImpactScores(true);
  const selected = useAppStore((s) => s.selectedDistrictId);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'score', dir: -1 });
  const [a, setA] = useState<string>(selected ?? 'lakshadweep');
  const [b, setB] = useState<string>('delhi');
  const byId = useMemo(() => new Map(districts.map((d) => [d.id, d])), [districts]);
  const rows = useMemo(() => {
    if (!scores) return [];
    const r = [...scores];
    r.sort((x, y) => {
      const vx = sort.key === 'name' ? byId.get(x.districtId)?.name ?? '' : x[sort.key];
      const vy = sort.key === 'name' ? byId.get(y.districtId)?.name ?? '' : y[sort.key];
      return (vx < vy ? -1 : vx > vy ? 1 : 0) * sort.dir;
    });
    return r;
  }, [scores, sort, byId]);
  const rank = useMemo(() => new Map([...(scores ?? [])].sort((x, y) => y.score - x.score).map((s, i) => [s.districtId, i + 1])), [scores]);
  const totals = useMemo(() => {
    if (!scores) return null;
    return {
      co2: scores.reduce((s, x) => s + x.co2AvoidedT, 0),
      diesel: scores.reduce((s, x) => s + x.dieselSavedL, 0),
      homes: scores.reduce((s, x) => s + x.homes, 0),
      top: [...scores].sort((x, y) => y.score - x.score)[0],
    };
  }, [scores]);
  const head = (key: SortKey, label: string, right = false) => {
    const on = sort.key === key;
    return (
      <th scope="col" aria-sort={on ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'} className={clsx('py-2 font-medium', right && 'text-right')}>
        <button className={clsx('inline-flex min-h-[36px] items-center gap-1 hover:text-aqua', on && 'text-aqua')} onClick={() => setSort({ key, dir: on ? ((-sort.dir) as 1 | -1) : key === 'name' || key === 'lcoe' ? 1 : -1 })}>
          {label} {on && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
        </button>
      </th>
    );
  };
  const sa = scores?.find((s) => s.districtId === a);
  const sb = scores?.find((s) => s.districtId === b);
  return (
    <>
      <PageHeader eyebrow={t('impact.eyebrow')} title={t('impact.title')} sub={<span className="flex flex-wrap items-center gap-2">{t('impact.sub')} <AssumptionBadge title={t('impact.assumptionHint')} /></span>} />
      <Container className="mt-6 space-y-6">
        {!scores || !totals ? (
          <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Tile label={t('impact.tiles.co2')} value={totals.co2} unit={t('impact.tiles.co2Unit')} accent="mint" sub={t('impact.tiles.perYear')} />
            <Tile label={t('impact.tiles.diesel')} value={totals.diesel / 1e5} digits={1} unit={t('impact.tiles.dieselUnit')} accent="amber" sub={t('impact.tiles.perYear')} />
            <Tile label={t('impact.tiles.homes')} value={totals.homes} unit={t('loads.homes')} sub={t('impact.tiles.homesSub')} />
            <Tile label={t('impact.tiles.top')} icon={<Gauge size={18} />}>
              <p className="font-display text-xl font-extrabold leading-none text-aqua">{byId.get(totals.top.districtId)?.name}</p>
              <p className="text-xs text-muted">{t('impact.tiles.topSub', { score: fmtNum(totals.top.score, 0) })}</p>
            </Tile>
          </div>
        )}

        <Card>
          <CardTitle>{t('impact.compare')}</CardTitle>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            {[
              [a, setA, 'A'],
              [b, setB, 'B'],
            ].map(([v, set, k]) => (
              <label key={k as string} className="flex flex-col gap-1 text-xs text-muted">
                {t('impact.district', { k })}
                <select className="field" value={v as string} onChange={(e) => (set as (x: string) => void)(e.target.value)}>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}, {d.state}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {sa && sb ? (
            <div className="grid gap-8 sm:grid-cols-2">
              <CompareCol s={sa} name={byId.get(a)!.name} state={byId.get(a)!.state} />
              <CompareCol s={sb} name={byId.get(b)!.name} state={byId.get(b)!.state} />
            </div>
          ) : (
            <Skeleton className="h-64" />
          )}
        </Card>

        <Card>
          <CardTitle right={<Badge>{t('impact.weights')}</Badge>}>{t('impact.ranked')}</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <caption className="sr-only">{t('impact.ranked')}</caption>
              <thead>
                <tr className="border-b border-line/30 text-left text-xs text-muted">
                  <th scope="col" className="w-10 py-2 font-medium">#</th>
                  {head('name', t('impact.cols.district'))}
                  {head('score', t('impact.cols.score'), true)}
                  {head('co2AvoidedT', t('impact.cols.co2'), true)}
                  {head('dieselSavedL', t('impact.cols.diesel'), true)}
                  {head('homesPerCrore', t('impact.cols.homes'), true)}
                  {head('lcoe', t('impact.cols.lcoe'), true)}
                  <th scope="col" className="py-2 font-medium">{t('impact.cols.option')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => {
                  const d = byId.get(s.districtId);
                  return (
                    <tr key={s.districtId} className={clsx('border-b border-line/15', s.districtId === selected && 'bg-aqua/5')}>
                      <td className="num py-2 text-muted">{rank.get(s.districtId)}</td>
                      <td className="py-2"><span className="font-medium">{d?.name}</span> <span className="text-xs text-muted">{d?.state}</span></td>
                      <td className="py-2 text-right">
                        <span className="inline-flex items-center gap-2">
                          <span className="hidden h-1.5 w-16 rounded-full bg-line/30 sm:block"><span className="block h-full rounded-full bg-aqua" style={{ width: `${s.score}%` }} /></span>
                          <span className="num font-semibold">{fmtNum(s.score, 0)}</span>
                        </span>
                      </td>
                      <td className="num py-2 text-right">{fmtNum(s.co2AvoidedT, 0)}</td>
                      <td className="num py-2 text-right">{fmtIndian(s.dieselSavedL)}</td>
                      <td className="num py-2 text-right">{fmtNum(s.homesPerCrore, 0)}</td>
                      <td className="num py-2 text-right">₹{fmtNum(s.lcoe, 2)}</td>
                      <td className="py-2">{s.recommended && <OptionIcons id={s.recommended} size={14} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">{t('impact.note', { capex: fmtINR(1e7) })}</p>
        </Card>
      </Container>
    </>
  );
}
