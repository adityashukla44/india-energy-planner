import clsx from 'clsx';
import { MapPin, RotateCcw, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { PlanResult } from '../engine/plan';
import type { HomeTier, OptionId } from '../engine/types';
import { useData } from '../lib/data';
import { fmtINR, fmtNum } from '../lib/format';
import { useAppStore } from '../store/useAppStore';
import { Container } from './layout/Layout';
import { AssumptionBadge, Card, CardTitle, EmptyState, ErrorState, NumberField, Segmented, Skeleton, Slider, Toggle } from './ui';
import { DistrictPicker, ResourceIcon } from './ui/extras';

export const OPTION_ICONS: Record<OptionId, ('solar' | 'wind' | 'hydro' | 'diesel' | 'battery')[]> = {
  solar: ['solar', 'battery'],
  solar_hydro: ['solar', 'hydro'],
  solar_wind: ['solar', 'wind'],
  solar_diesel: ['solar', 'diesel'],
};

export function OptionIcons({ id, size = 16 }: { id: OptionId; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {OPTION_ICONS[id].map((k) => (
        <ResourceIcon key={k} kind={k} size={size} className={{ solar: 'text-amber', wind: 'text-aqua', hydro: 'text-hydro', diesel: 'text-critical', battery: 'text-mint' }[k]} />
      ))}
    </span>
  );
}

/** Blocks a page until data is loaded and a district is selected; offers a picker. */
export function DistrictGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { districts, loading, error, retry } = useData();
  const selected = useAppStore((s) => s.selectedDistrictId);
  const select = useAppStore((s) => s.selectDistrict);
  const nav = useNavigate();
  if (loading)
    return (
      <Container className="space-y-4 py-8">
        <Skeleton className="h-24" />
        <div className="grid gap-4 md:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </Container>
    );
  if (error)
    return (
      <Container className="py-12">
        <Card>
          <ErrorState title={t('errors.dataTitle')} body={t('errors.dataBody')} onRetry={retry} />
        </Card>
      </Container>
    );
  if (!selected || !districts.some((d) => d.id === selected)) {
    const suggestions = ['jaisalmer', 'leh', 'idukki', 'tirunelveli', 'lakshadweep', 'gadchiroli'];
    return (
      <Container className="py-12">
        <h1 className="sr-only">{t('gate.title')}</h1>
        <Card className="mx-auto max-w-2xl">
          <EmptyState
            icon={<MapPin aria-hidden />}
            title={t('gate.title')}
            body={t('gate.body')}
            action={
              <div className="flex w-full max-w-md flex-col gap-4">
                <DistrictPicker districts={districts} onPick={(d) => select(d.id)} />
                <div className="flex flex-wrap justify-center gap-2">
                  {suggestions.map((id) => {
                    const d = districts.find((x) => x.id === id);
                    if (!d) return null;
                    return (
                      <button key={id} className="chip min-h-[36px] border-line/60 px-3 text-text hover:border-aqua" onClick={() => select(id)}>
                        {d.name}
                      </button>
                    );
                  })}
                </div>
                <button className="btn-ghost mx-auto" onClick={() => nav('/map')}>
                  <MapPin size={16} aria-hidden /> {t('gate.openMap')}
                </button>
              </div>
            }
          />
        </Card>
      </Container>
    );
  }
  return <>{children}</>;
}

export function useOptionName() {
  const { t } = useTranslation();
  return (id: OptionId | null) => (id ? t(`options.${id}`) : t('options.none'));
}

/** Which design is shown: follows the recommendation unless the user picks one. */
export function OptionSwitcher({ plan, className }: { plan: PlanResult; className?: string }) {
  const { t } = useTranslation();
  const selected = useAppStore((s) => s.selectedOption);
  const setSelected = useAppStore((s) => s.setSelectedOption);
  const name = useOptionName();
  const value = (selected && plan.options.find((o) => o.id === selected)?.available ? selected : 'auto') as OptionId | 'auto';
  return (
    <Segmented
      className={className}
      size="sm"
      label={t('options.switcher')}
      value={value}
      onChange={(v) => setSelected(v === 'auto' ? null : (v as OptionId))}
      options={[
        { value: 'auto', label: t('options.recommendedShort') },
        ...plan.options.map((o) => ({ value: o.id, label: name(o.id), disabled: !o.available, title: o.reasonKey ? t(o.reasonKey) : undefined })),
      ]}
    />
  );
}

export function DemandBuilder() {
  const { t } = useTranslation();
  const d = useAppStore((s) => s.demand);
  const set = useAppStore((s) => s.setDemand);
  const reset = useAppStore((s) => s.resetDemand);
  return (
    <Card>
      <CardTitle
        icon={<ResourceIcon kind="homes" />}
        right={
          <button className="flex min-h-[36px] items-center gap-1.5 text-xs text-muted hover:text-aqua" onClick={reset}>
            <RotateCcw size={14} aria-hidden /> {t('common.reset')}
          </button>
        }
      >
        {t('demand.title')}
      </CardTitle>
      <div className="space-y-5">
        <fieldset className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <legend className="sr-only">{t('loads.homes')}</legend>
          <NumberField label={t('demand.homes')} value={d.homes} min={0} max={50000} step={10} onChange={(v) => set({ homes: v })} />
          <div className="flex flex-col gap-1">
            <label htmlFor="home-tier" className="text-xs font-medium text-muted">
              {t('demand.homeTier')}
            </label>
            <select id="home-tier" className="field" value={d.homeTier} onChange={(e) => set({ homeTier: e.target.value as HomeTier })}>
              <option value="basic">{t('demand.tiers.basic')}</option>
              <option value="standard">{t('demand.tiers.standard')}</option>
              <option value="high">{t('demand.tiers.high')}</option>
            </select>
          </div>
        </fieldset>
        <fieldset className="space-y-2 border-t border-line/30 pt-4">
          <legend className="sr-only">{t('loads.clinic')}</legend>
          <Toggle checked={d.clinic} onChange={(v) => set({ clinic: v })} label={<span className="flex items-center gap-2"><ResourceIcon kind="clinic" className="text-critical" /> {t('demand.clinic')}</span>} />
          {d.clinic && (
            <div className="grid grid-cols-2 items-end gap-3">
              <NumberField label={t('demand.clinicKwh')} value={d.clinicKwh} min={1} max={500} step={1} unit="kWh" onChange={(v) => set({ clinicKwh: v })} />
              <Toggle checked={d.clinicCritical} onChange={(v) => set({ clinicCritical: v })} label={t('demand.critical')} />
            </div>
          )}
        </fieldset>
        <fieldset className="space-y-2 border-t border-line/30 pt-4">
          <legend className="sr-only">{t('loads.school')}</legend>
          <Toggle checked={d.school} onChange={(v) => set({ school: v })} label={<span className="flex items-center gap-2"><ResourceIcon kind="school" className="text-amber" /> {t('demand.school')}</span>} />
          {d.school && <NumberField label={t('demand.schoolKwh')} value={d.schoolKwh} min={1} max={500} step={1} unit="kWh" onChange={(v) => set({ schoolKwh: v })} />}
        </fieldset>
        <fieldset className="border-t border-line/30 pt-4">
          <legend className="mb-2 flex items-center gap-2 text-sm text-text">
            <ResourceIcon kind="pump" className="text-hydro" /> {t('demand.pumps')}
          </legend>
          <div className="grid grid-cols-3 gap-2">
            <NumberField compact label={t('demand.count')} value={d.pumps} min={0} max={500} onChange={(v) => set({ pumps: v })} />
            <NumberField compact label={t('demand.hp')} value={d.pumpHp} min={0.5} max={50} step={0.5} onChange={(v) => set({ pumpHp: v })} />
            <NumberField compact label={t('demand.hours')} value={d.pumpHours} min={0.5} max={12} step={0.5} onChange={(v) => set({ pumpHours: v })} />
          </div>
        </fieldset>
        <fieldset className="border-t border-line/30 pt-4">
          <legend className="mb-2 flex items-center gap-2 text-sm text-text">
            <ResourceIcon kind="streetlights" className="text-amber" /> {t('demand.streetlights')}
          </legend>
          <div className="grid grid-cols-3 gap-2">
            <NumberField compact label={t('demand.count')} value={d.streetlights} min={0} max={5000} step={5} onChange={(v) => set({ streetlights: v })} />
            <NumberField compact label={t('demand.watts')} value={d.streetlightW} min={5} max={250} step={5} onChange={(v) => set({ streetlightW: v })} />
            <NumberField compact label={t('demand.other')} value={d.otherKwh} min={0} max={100000} step={5} unit="kWh" onChange={(v) => set({ otherKwh: v })} />
          </div>
        </fieldset>
      </div>
    </Card>
  );
}

export function ScenarioSliders({ showCosts }: { showCosts?: boolean }) {
  const { t } = useTranslation();
  const s = useAppStore((x) => x.scenario);
  const set = useAppStore((x) => x.setScenario);
  const resetScenario = useAppStore((x) => x.resetScenario);
  const chemistry = useAppStore((x) => x.chemistry);
  const setChem = useAppStore((x) => x.setChemistry);
  const overrides = useAppStore((x) => x.costOverrides);
  const setOverride = useAppStore((x) => x.setCostOverride);
  const { costsFile } = useData();
  const item = (k: string) => costsFile?.items[k];
  const batt = item(chemistry === 'lfp' ? 'lfp_capex_per_kwh' : 'leadacid_capex_per_kwh');
  const diesel = item('diesel_price_per_l');
  const solar = item('solar_capex_per_kw');
  const grid = item('grid_tariff_per_kwh');
  const reset = () => {
    resetScenario();
    setOverride('solar_capex_per_kw', undefined);
    setOverride('grid_tariff_per_kwh', undefined);
  };
  return (
    <Card>
      <CardTitle
        icon={<SlidersHorizontal size={18} />}
        right={
          <button className="flex min-h-[36px] items-center gap-1.5 text-xs text-muted hover:text-aqua" onClick={reset}>
            <RotateCcw size={14} aria-hidden /> {t('common.reset')}
          </button>
        }
      >
        {t('scenario.title')}
      </CardTitle>
      <div className="space-y-3">
        <Slider label={t('scenario.growth')} value={s.demandGrowthPct} min={0} max={10} step={0.5} onChange={(v) => set({ demandGrowthPct: v })} format={(v) => `${fmtNum(v, 1)}% / ${t('units.yr')}`} />
        <Slider label={t('scenario.diesel')} value={s.dieselPrice} min={diesel?.min ?? 70} max={diesel?.max ?? 130} step={1} onChange={(v) => set({ dieselPrice: v })} format={(v) => `₹${fmtNum(v)} / L`} />
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-sm text-text">{t('scenario.chemistry')}</span>
          <Segmented
            size="sm"
            label={t('scenario.chemistry')}
            value={chemistry}
            onChange={(c) => setChem(c, item(c === 'lfp' ? 'lfp_capex_per_kwh' : 'leadacid_capex_per_kwh')?.value ?? 27000)}
            options={[
              { value: 'lfp', label: t('scenario.lfp') },
              { value: 'leadacid', label: t('scenario.leadacid') },
            ]}
          />
        </div>
        <Slider label={t('scenario.battery')} value={s.batteryCost} min={batt?.min ?? 20000} max={batt?.max ?? 35000} step={batt?.step ?? 500} onChange={(v) => set({ batteryCost: v })} format={(v) => `${fmtINR(v, { compact: false })} / kWh`} />
        <Slider label={t('scenario.storm')} value={s.stormDays} min={1} max={5} step={1} onChange={(v) => set({ stormDays: v })} format={(v) => t('scenario.days', { count: v })} hint={t('scenario.stormHint')} badge={<AssumptionBadge />} />
        <Slider label={t('scenario.hydro')} value={s.hydroFlowReductionPct} min={0} max={60} step={5} onChange={(v) => set({ hydroFlowReductionPct: v })} format={(v) => `−${fmtNum(v)}%`} hint={t('scenario.hydroHint')} />
        {showCosts && (
          <div className={clsx('space-y-3 border-t border-line/30 pt-3')}>
            <Slider
              label={t('scenario.solar')}
              value={overrides.solar_capex_per_kw ?? solar?.value ?? 55000}
              min={solar?.min ?? 50000}
              max={solar?.max ?? 67000}
              step={solar?.step ?? 500}
              onChange={(v) => setOverride('solar_capex_per_kw', v)}
              format={(v) => `${fmtINR(v, { compact: false })} / kW`}
            />
            <Slider
              label={t('scenario.grid')}
              value={overrides.grid_tariff_per_kwh ?? grid?.value ?? 8}
              min={grid?.min ?? 7.5}
              max={grid?.max ?? 9.5}
              step={0.1}
              onChange={(v) => setOverride('grid_tariff_per_kwh', v)}
              format={(v) => `₹${fmtNum(v, 2)} / kWh`}
            />
          </div>
        )}
      </div>
    </Card>
  );
}
