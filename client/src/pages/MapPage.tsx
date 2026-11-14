import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Layers, X } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { OptionIcons, useOptionName } from '../components/planner';
import { Bar, Card, ErrorState, IllustrativeBadge, Segmented, Skeleton } from '../components/ui';
import { DistrictPicker, RES_COLOR, ResourceIcon } from '../components/ui/extras';
import { DEFAULT_DEMAND } from '../engine/demand';
import { DEFAULT_SCENARIO, planDistrict } from '../engine/plan';
import { annualWindCF, bestResource, mean, resourceScores, worstGhiMonth } from '../engine/resource';
import type { District } from '../engine/types';
import { useCostParams, useData } from '../lib/data';
import { fmtINR, fmtIndian, fmtNum, monthShort } from '../lib/format';
import { useImpactScores, useMediaQuery, useThemeColors } from '../lib/hooks';
import { RAMPS, RAMPS_LIGHT, bestColor, layerValues, type LayerValue } from '../lib/layers';
import { useAppStore, type MapLayer } from '../store/useAppStore';
import { SceneShell } from '../three/core';
import { Map2D } from '../three/Map2D';

const IndiaMap3D = lazy(() => import('../three/IndiaMap3D'));
const DistrictDiorama = lazy(() => import('../three/DistrictDiorama'));

const LAYERS: MapLayer[] = ['best', 'impact', 'solar', 'wind', 'demand'];

function Legend({ layer }: { layer: MapLayer }) {
  const { t } = useTranslation();
  const tk = useThemeColors();
  if (layer === 'best')
    return (
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {(['solar', 'wind', 'hydro', 'biomass'] as const).map((k) => (
          <li key={k} className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-[4px]" style={{ background: bestColor(k, tk), boxShadow: `0 0 8px ${bestColor(k, tk)}` }} />
            {t(`res.${k}`)}
          </li>
        ))}
      </ul>
    );
  const stops = (tk.dark ? RAMPS : RAMPS_LIGHT)[layer];
  return (
    <div>
      <div className="h-2.5 w-full rounded-full" style={{ background: `linear-gradient(90deg, ${stops.join(',')})` }} />
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>{t(`map.legend.${layer}.low`)}</span>
        <span>{t(`map.legend.${layer}.high`)}</span>
      </div>
    </div>
  );
}

const tierText = (t: (k: string) => string, tier: string) => t(`tiers.${tier}`);

function Profile({ d, onClose }: { d: District; onClose: () => void }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const select = useAppStore((s) => s.selectDistrict);
  const costs = useCostParams();
  const optionName = useOptionName();
  const s = resourceScores(d);
  const ghi = mean(d.ghi_monthly);
  const wm = worstGhiMonth(d);
  const plan = useMemo(() => (costs ? planDistrict(d, DEFAULT_DEMAND, { ...DEFAULT_SCENARIO, batteryCost: costs.lfp_capex_per_kwh, dieselPrice: costs.diesel_price_per_l }, costs) : null), [d, costs]);
  const rec = plan?.options.find((o) => o.id === plan.recommended);
  const best = bestResource(d);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-line/30 p-5">
        <div className="min-w-0">
          <p className="eyebrow">{t(`categories.${d.category}`)}</p>
          <h2 className="mt-1 truncate font-display text-xl font-extrabold">{d.name}</h2>
          <p className="text-sm text-muted">{d.state}</p>
          {d.illustrative && (
            <div className="mt-2">
              <IllustrativeBadge />
            </div>
          )}
        </div>
        <button onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-btn text-muted hover:text-text" aria-label={t('common.close')}>
          <X size={20} />
        </button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-5">
        <Suspense fallback={<Skeleton className="h-44" />}>
          <DistrictDiorama district={d} className="h-44 overflow-hidden rounded-card border border-line/30" />
        </Suspense>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-btn border border-line/30 p-3">
            <dt className="text-xs text-muted">{t('map.population')}</dt>
            <dd className="num mt-0.5 font-semibold">{fmtIndian(d.population_est)}</dd>
          </div>
          <div className="rounded-btn border border-line/30 p-3">
            <dt className="text-xs text-muted">{t('map.demand')}</dt>
            <dd className="num mt-0.5 font-semibold">{fmtIndian(d.demand_mwh_yr_est)} MWh/{t('units.yr')}</dd>
          </div>
          <div className="rounded-btn border border-line/30 p-3">
            <dt className="text-xs text-muted">{t('map.grid')}</dt>
            <dd className="mt-0.5 font-semibold">{t(`grid.${d.grid_access}`)}</dd>
          </div>
          <div className="rounded-btn border border-line/30 p-3">
            <dt className="text-xs text-muted">{t('map.dieselDep')}</dt>
            <dd className="mt-0.5 font-semibold">{tierText(t, d.diesel_dependence)}</dd>
          </div>
        </dl>
        <section aria-labelledby="res-h" className="space-y-3">
          <h3 id="res-h" className="text-sm font-semibold">
            {t('map.resources')}
          </h3>
          <Bar label={t('res.solar')} value={s.solar} color={RES_COLOR.solar} valueText={t('map.solarVal', { v: fmtNum(ghi, 2), worst: monthShort(wm), w: fmtNum(d.ghi_monthly[wm], 2) })} />
          <Bar label={t('res.wind')} value={s.wind} color={RES_COLOR.wind} valueText={t('map.windVal', { v: fmtNum(mean(d.wind50m_monthly), 1), cf: fmtNum(annualWindCF(d) * 100, 0) })} />
          <Bar label={t('res.hydroLong')} value={s.hydro} color={RES_COLOR.hydro} valueText={tierText(t, d.small_hydro_potential)} />
          <Bar label={t('res.biomass')} value={s.biomass} color={RES_COLOR.biomass} valueText={tierText(t, d.biomass_potential)} />
          <Bar label={t('res.geothermal')} value={s.geothermal} color={RES_COLOR.geothermal} valueText={d.geothermal_potential === 'potential' ? t('map.geoPotential') : t('tiers.none')} />
          {d.geothermal_potential === 'potential' && <p className="text-xs text-muted">{t('map.geoNote')}</p>}
        </section>
        <section className="rounded-card border border-aqua/30 bg-aqua/5 p-4" aria-labelledby="fit-h">
          <h3 id="fit-h" className="flex items-center gap-2 text-sm font-semibold">
            <ResourceIcon kind={best} className="text-aqua" /> {t('map.bestFit', { res: t(`res.${best}`) })}
          </h3>
          {plan && rec ? (
            <p className="mt-2 text-sm text-muted">
              {t('map.bestFitBody', { option: optionName(rec.id), capex: fmtINR(rec.life.capex.total), lcoe: fmtNum(rec.life.lcoe, 1) })}{' '}
              <span className="inline-flex align-middle">
                <OptionIcons id={rec.id} size={14} />
              </span>
            </p>
          ) : (
            <Skeleton className="mt-2 h-10" />
          )}
          <p className="mt-2 text-xs text-muted">{t('map.bestFitNote')}</p>
        </section>
      </div>
      <div className="border-t border-line/30 p-5">
        <button
          className="btn-primary w-full text-base"
          onClick={() => {
            select(d.id);
            nav('/planner');
          }}
        >
          {t('map.planThis')} <ArrowRight size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export default function MapPage() {
  const { t } = useTranslation();
  const { districts, loading, error, retry } = useData();
  const tk = useThemeColors();
  const layer = useAppStore((s) => s.mapLayer);
  const setLayer = useAppStore((s) => s.setMapLayer);
  const selectedId = useAppStore((s) => s.selectedDistrictId);
  const select = useAppStore((s) => s.selectDistrict);
  const reduced = useReducedMotion();
  const phone = useMediaQuery('(max-width: 767px)');
  const impact = useImpactScores(layer === 'impact');
  const values = useMemo(() => layerValues(districts, layer, tk, impact), [districts, layer, tk, impact]);
  const [panelOpen, setPanelOpen] = useState(true);
  const selected = districts.find((d) => d.id === selectedId) ?? null;
  const pick = (d: District) => {
    select(d.id);
    setPanelOpen(true);
  };
  const showPanel = !!selected && panelOpen;
  const tooltip = (d: District, v?: LayerValue) => (
    <span>
      <strong className="font-semibold">{d.name}</strong> <span className="text-muted">· {d.state}</span>
      {v && <span className="num block text-aqua">{layer === 'best' ? t(`res.${v.valueText}`) : v.valueText}</span>}
    </span>
  );

  if (error)
    return (
      <div className="p-8">
        <Card>
          <ErrorState title={t('errors.dataTitle')} body={t('errors.dataBody')} onRetry={retry} />
        </Card>
      </div>
    );

  return (
    <div className="relative h-[calc(100dvh-64px-56px)] min-h-[560px] overflow-hidden lg:h-[calc(100dvh-64px)]">
      <h1 className="sr-only">{t('map.title')}</h1>
      {loading ? (
        <Skeleton className="absolute inset-4" />
      ) : (
        <SceneShell
          className="absolute inset-0"
          label={t('map.sceneAria')}
          canvas={{ camera: { position: [0, 15.5, 11.5], fov: 38, near: 0.1, far: 90 } }}
          toggleClassName="bottom-4 right-4"
          fallback={
            <div className="absolute inset-0 overflow-auto p-4 pb-40 pt-28 md:px-16">
              <Map2D districts={districts} values={values} selectedId={selectedId} onSelect={pick} className="mx-auto max-h-[calc(100dvh-200px)] max-w-[720px]" />
            </div>
          }
        >
          <IndiaMap3D districts={districts} values={values} selectedId={selectedId} onSelect={pick} tooltip={tooltip} />
        </SceneShell>
      )}

      {/* Keyboard / screen-reader access to the 3D points */}
      <nav aria-label={t('map.listAria')} className="sr-only-focusable absolute left-4 top-40 z-20 max-h-[50vh] w-64 overflow-auto rounded-card bg-panel p-2">
        <ul>
          {districts.map((d) => (
            <li key={d.id}>
              <button className="w-full rounded-btn px-3 py-2 text-left text-sm hover:bg-aqua/10" onClick={() => pick(d)} aria-pressed={d.id === selectedId}>
                {d.name}, {d.state}: {values.get(d.id)?.valueText}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Layer switcher (top-left) */}
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <Card pad={false} className="pointer-events-auto w-fit max-w-full p-2">
          <div className="flex items-center gap-2 px-2 pb-1.5 pt-1 text-xs font-medium text-muted">
            <Layers size={14} aria-hidden /> {t('map.layer')}
          </div>
          <Segmented size="sm" label={t('map.layer')} value={layer} onChange={setLayer} options={LAYERS.map((l) => ({ value: l, label: t(`map.layers.${l}`) }))} />
        </Card>
        {/* Search (top-right) */}
        <div className="pointer-events-auto w-full md:w-80" style={{ marginRight: showPanel && !phone ? 440 : 0, transition: 'margin 0.3s' }}>
          <DistrictPicker districts={districts} onPick={pick} placeholder={t('map.search')} inputClassName="!bg-panel shadow-card" />
        </div>
      </div>

      {/* Legend (bottom-left) */}
      <Card className="absolute bottom-4 left-4 z-10 w-[min(300px,calc(100%-2rem))] p-4">
        <p className="mb-2 text-xs font-semibold">{t(`map.layers.${layer}`)}</p>
        <Legend layer={layer} />
        <p className="mt-2 text-[11px] text-muted">{t('map.legendNote')}</p>
        {layer === 'impact' && !impact && <p className="mt-1 text-[11px] text-aqua">{t('map.computing')}</p>}
      </Card>

      {/* Slide-in profile */}
      <AnimatePresence>
        {showPanel && selected && (
          <motion.aside
            key="profile"
            aria-label={t('map.profileAria', { name: selected.name })}
            className="glass absolute z-30 flex flex-col overflow-hidden max-md:inset-x-0 max-md:bottom-0 max-md:max-h-[58%] max-md:rounded-t-card md:bottom-4 md:right-4 md:top-4 md:w-[420px] md:rounded-card"
            initial={reduced ? { opacity: 0 } : phone ? { y: '100%' } : { x: 460 }}
            animate={reduced ? { opacity: 1 } : phone ? { y: 0 } : { x: 0 }}
            exit={reduced ? { opacity: 0 } : phone ? { y: '100%' } : { x: 460 }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
          >
            <Profile d={selected} onClose={() => setPanelOpen(false)} />
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
