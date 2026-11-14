import { Info, MapPin, Moon, Sun } from 'lucide-react';
import { lazy, Suspense, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MonthlyBalanceChart } from '../components/charts';
import { Container, PageHeader } from '../components/layout/Layout';
import { DemandBuilder, DistrictGate, OptionIcons, OptionSwitcher, ScenarioSliders, useOptionName } from '../components/planner';
import { ArcGauge, Badge, Card, CardTitle, CountUp, IllustrativeBadge, RingGauge, Segmented, Skeleton, Tile } from '../components/ui';
import { ResourceIcon } from '../components/ui/extras';
import { mean } from '../engine/resource';
import { fmtNum, monthShort } from '../lib/format';
import { usePlan } from '../lib/hooks';

const SystemScene = lazy(() => import('../three/SystemScene'));

function PlannerBody() {
  const { t } = useTranslation();
  const { district, plan, active, pending } = usePlan();
  const optionName = useOptionName();
  const [night, setNight] = useState(false);
  if (!district || !plan || !active) return null;
  const { demand } = plan;
  const empty = demand.totalKwhDay <= 0;
  const rel = active.sim.worstReliability;
  const produced = active.sim.annualPv - active.sim.annualCurtailed + active.sim.annualWind + active.sim.annualHydro + active.sim.annualDiesel;
  return (
    <>
      <PageHeader
        eyebrow={t('planner.eyebrow')}
        title={t('planner.title', { name: district.name })}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {t('planner.sub')} {district.illustrative && <IllustrativeBadge />}
          </span>
        }
        right={
          <Link to="/map" className="btn-ghost">
            <MapPin size={16} aria-hidden /> {t('planner.change')}
          </Link>
        }
      />
      <Container className="mt-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5" aria-live="polite" aria-busy={pending}>
          <Tile label={t('planner.tiles.demand')} value={demand.totalKwhDay} digits={1} unit={`kWh/${t('units.day')}`} icon={<ResourceIcon kind="homes" />} sub={t('planner.tiles.peak', { v: fmtNum(demand.peakKw, 1) })} />
          <Tile label={t('planner.tiles.pv')} value={active.spec.pvKwp} digits={1} unit="kWp" icon={<ResourceIcon kind="solar" />} accent="amber" sub={t('planner.tiles.pvSub', { v: fmtNum(mean(district.ghi_monthly), 2) })} />
          <Tile label={t('planner.tiles.battery')} value={active.spec.batteryKwh} digits={0} unit="kWh" icon={<ResourceIcon kind="battery" />} accent="mint" sub={t(`scenario.${active.spec.chemistry}`)} />
          <Card className="col-span-2 flex items-center gap-4 sm:col-span-1">
            <RingGauge value={rel} label={t('planner.tiles.relAria', { pct: fmtNum(rel * 100, 1) })} size={92} stroke={10} color={rel >= 0.99 ? 'rgb(var(--mint))' : 'rgb(var(--warning))'}>
              <span className="num font-display text-base font-extrabold">
                <CountUp value={rel * 100} digits={1} />%
              </span>
            </RingGauge>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('planner.tiles.rel')}</p>
              <p className="mt-1 text-xs text-muted">{t('planner.tiles.relSub', { m: monthShort(active.sim.worstMonth) })}</p>
            </div>
          </Card>
          <Tile label={t('planner.tiles.mix')} className="col-span-2 lg:col-span-1" accent="aqua">
            <div className="flex items-center gap-2">
              <OptionIcons id={active.id} size={20} />
              <span className="font-display text-base font-bold leading-tight">{optionName(active.id)}</span>
            </div>
            <p className="text-xs text-muted">{plan.recommended === active.id ? t('planner.tiles.isRec') : t('planner.tiles.notRec', { rec: optionName(plan.recommended) })}</p>
          </Tile>
        </div>

        {empty && (
          <Card role="status" className="flex items-center gap-3 border-amber/40 text-sm">
            <Info className="text-amber" aria-hidden /> {t('planner.emptyDemand')}
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5 xl:col-span-4">
            <DemandBuilder />
            <ScenarioSliders />
          </div>
          <div className="order-first space-y-6 lg:sticky lg:top-20 lg:order-none lg:col-span-7 lg:self-start xl:col-span-8">
            <Card pad={false} className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 pb-3">
                <h2 className="font-display text-base font-semibold">{t('planner.scene')}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <OptionSwitcher plan={plan} />
                  <Segmented
                    size="sm"
                    label={t('planner.dayNight')}
                    value={night ? 'night' : 'day'}
                    onChange={(v) => setNight(v === 'night')}
                    options={[
                      { value: 'day', label: <><Sun size={14} aria-hidden /> {t('planner.day')}</> },
                      { value: 'night', label: <><Moon size={14} aria-hidden /> {t('planner.night')}</> },
                    ]}
                  />
                </div>
              </div>
              <Suspense fallback={<Skeleton className="m-4 h-[420px]" />}>
                <SystemScene
                  spec={active.spec}
                  demand={demand}
                  night={night}
                  windMean={mean(district.wind50m_monthly)}
                  className="h-[440px] rounded-none"
                  label={t('planner.sceneAria', { option: optionName(active.id), pv: fmtNum(active.spec.pvKwp, 1), batt: fmtNum(active.spec.batteryKwh, 0) })}
                />
              </Suspense>
              <p className="flex items-center gap-2 border-t border-line/30 px-4 py-3 text-xs text-muted">
                <Info size={14} aria-hidden /> {night ? (active.spec.dieselKva > 0 ? t('planner.nightDiesel') : t('planner.nightNote')) : t('planner.dayNote')}
              </p>
            </Card>
            <Card>
              <CardTitle right={<Badge tone="muted">{t('planner.estimate')}</Badge>}>{t('planner.monthly')}</CardTitle>
              <div className="grid items-center gap-6 md:grid-cols-[1fr_220px]">
                <MonthlyBalanceChart sim={active.sim} />
                <div className="flex flex-col items-center gap-2 text-center">
                  <ArcGauge produced={produced} consumed={active.sim.annualDemand} label={t('planner.arcAria')} centerLabel={t('planner.arcCenter')} />
                  <p className="text-xs text-muted">{t('planner.arcNote')}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </Container>
    </>
  );
}

export default function Planner() {
  return (
    <DistrictGate>
      <PlannerBody />
    </DistrictGate>
  );
}
