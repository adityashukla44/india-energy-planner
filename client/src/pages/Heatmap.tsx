import { Info } from 'lucide-react';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Container, PageHeader } from '../components/layout/Layout';
import { Badge, Card, CardTitle, Skeleton } from '../components/ui';
import type { District } from '../engine/types';
import { COMPLAINT_TYPES } from '../lib/complaints';
import { loadJson, useData } from '../lib/data';
import { fmtNum } from '../lib/format';
import { useThemeColors } from '../lib/hooks';
import type { LayerValue } from '../lib/layers';
import { SceneShell } from '../three/core';
import type { Counts } from '../three/HeatmapScene';
import { Map2D } from '../three/Map2D';

const HeatmapScene = lazy(() => import('../three/HeatmapScene'));

interface Row {
  district: string;
  type: string;
  count: number;
  samples?: number;
}

export default function Heatmap() {
  const { t } = useTranslation();
  const { districts } = useData();
  const tk = useThemeColors();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [type, setType] = useState<string>('all');
  const [district, setDistrict] = useState<string>('all');
  useEffect(() => {
    fetch('/api/complaints/heatmap')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((r: Row[]) => setRows(r))
      .catch(async () => {
        // Offline / no server: use the bundled sample reports.
        setOffline(true);
        const s = await loadJson<{ district: string; type: string }[]>('sample-complaints.json').catch(() => {
          setUnreachable(true);
          return [];
        });
        const m = new Map<string, Row>();
        for (const c of s) {
          const k = `${c.district}|${c.type}`;
          const r = m.get(k) ?? { district: c.district, type: c.type, count: 0, samples: 0 };
          r.count++;
          r.samples = (r.samples ?? 0) + 1;
          m.set(k, r);
        }
        setRows([...m.values()]);
      });
  }, []);
  const colors: Record<string, string> = useMemo(
    () => ({ outage: tk.critical, low_voltage: tk.amber, fluctuation: tk.geo, sparking: tk.cyan, streetlight: tk.hydro, billing: tk.mint, other: tk.muted }),
    [tk],
  );
  const types = type === 'all' ? [...COMPLAINT_TYPES] : [type];
  const counts: Counts = useMemo(() => {
    const m: Counts = new Map();
    for (const r of rows ?? []) {
      if (!types.includes(r.type as (typeof COMPLAINT_TYPES)[number])) continue;
      if (district !== 'all' && r.district !== district) continue;
      const c = m.get(r.district) ?? {};
      c[r.type] = (c[r.type] ?? 0) + r.count;
      m.set(r.district, c);
    }
    return m;
  }, [rows, type, district]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = (c?: Record<string, number>) => (c ? Object.values(c).reduce((a, b) => a + b, 0) : 0);
  const max = Math.max(1, ...[...counts.values()].map(total));
  const values2d = useMemo(() => {
    const v = new Map<string, LayerValue>();
    for (const d of districts) {
      const n = total(counts.get(d.id));
      if (n) v.set(d.id, { v01: n / max, color: tk.critical, valueText: t('heatmap.reports', { count: n }) });
    }
    return v;
  }, [counts, districts, max, tk, t]);
  const ranked = [...counts.entries()].sort((a, b) => total(b[1]) - total(a[1]));
  const sampleCount = (rows ?? []).reduce((s, r) => s + (r.samples ?? 0), 0);
  const name = (id: string) => districts.find((d) => d.id === id)?.name ?? id;
  const tip = (d: District, c: Record<string, number>) => (
    <span>
      <strong>{d.name}</strong>
      {Object.entries(c).map(([k, n]) => (
        <span key={k} className="block">
          <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: colors[k] }} />
          {t(`complaints.types.${k}`)}: <span className="num">{n}</span>
        </span>
      ))}
    </span>
  );
  return (
    <>
      <PageHeader
        eyebrow={t('heatmap.eyebrow')}
        title={t('heatmap.title')}
        sub={<span className="flex flex-wrap items-center gap-2">{t('heatmap.sub')} {sampleCount > 0 && <Badge tone="sample">{t('heatmap.sampleBadge', { count: sampleCount })}</Badge>}</span>}
      />
      <Container className="mt-6 grid gap-6 lg:grid-cols-12">
        <Card pad={false} className="relative overflow-hidden lg:col-span-8">
          <div className="flex flex-wrap gap-3 p-4">
            <label className="flex flex-col gap-1 text-xs text-muted">
              {t('heatmap.type')}
              <select className="field" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="all">{t('heatmap.allTypes')}</option>
                {COMPLAINT_TYPES.map((x) => <option key={x} value={x}>{t(`complaints.types.${x}`)}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted">
              {t('complaints.district')}
              <select className="field" value={district} onChange={(e) => setDistrict(e.target.value)}>
                <option value="all">{t('heatmap.allDistricts')}</option>
                {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          </div>
          {!rows ? (
            <Skeleton className="m-4 h-[520px]" />
          ) : (
            <SceneShell
              className="h-[560px]"
              label={t('heatmap.sceneAria', { n: ranked.length })}
              canvas={{ camera: { position: [0, 15.5, 11.5], fov: 38 } }}
              fallback={<div className="p-4"><Map2D districts={districts} values={values2d} onSelect={(d) => setDistrict(d.id)} selectedId={district === 'all' ? null : district} className="mx-auto max-h-[520px] max-w-[520px]" /></div>}
            >
              <Suspense fallback={null}>
                <HeatmapScene districts={districts} counts={counts} types={types} colors={colors} selectedId={district === 'all' ? null : district} onSelect={setDistrict} label={tip} />
              </Suspense>
            </SceneShell>
          )}
          <ul className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line/30 p-4 text-xs">
            {COMPLAINT_TYPES.map((k) => (
              <li key={k} className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-[4px]" style={{ background: colors[k], boxShadow: `0 0 8px ${colors[k]}` }} /> {t(`complaints.types.${k}`)}
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-4 lg:col-span-4">
          {offline && (
            <Card role="status" className={unreachable ? 'flex items-start gap-3 border-critical/50 text-sm' : 'flex items-start gap-3 border-amber/40 text-sm'}>
              <Info size={18} className={unreachable ? 'mt-0.5 shrink-0 text-critical' : 'mt-0.5 shrink-0 text-amber'} aria-hidden />
              <span>
                {unreachable ? t('heatmap.unreachable') : t('heatmap.offline')}
                {unreachable && (
                  <button className="mt-2 block text-aqua hover:underline" onClick={() => location.reload()}>
                    {t('common.retry')}
                  </button>
                )}
              </span>
            </Card>
          )}
          <Card>
            <CardTitle>{t('heatmap.top')}</CardTitle>
            {ranked.length === 0 ? <p className="text-sm text-muted">{t('heatmap.empty')}</p> : (
              <ol className="space-y-2">
                {ranked.slice(0, 12).map(([id, c], i) => (
                  <li key={id}>
                    <button className="flex w-full items-center gap-3 rounded-btn px-2 py-1.5 text-left text-sm hover:bg-aqua/10" onClick={() => setDistrict(id)}>
                      <span className="num w-5 text-muted">{i + 1}</span>
                      <span className="flex-1">{name(id)}</span>
                      <span className="flex h-2 w-24 overflow-hidden rounded-full bg-line/30">
                        {COMPLAINT_TYPES.map((k) => (c[k] ? <span key={k} style={{ width: `${(c[k] / max) * 100}%`, background: colors[k] }} /> : null))}
                      </span>
                      <span className="num w-6 text-right font-semibold">{fmtNum(total(c))}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {district !== 'all' && <button className="btn-ghost mt-3 w-full" onClick={() => setDistrict('all')}>{t('heatmap.clear')}</button>}
          </Card>
          <p className="text-xs text-muted">{t('heatmap.note')}</p>
        </div>
      </Container>
    </>
  );
}
