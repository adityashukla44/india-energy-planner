import clsx from 'clsx';
import { AlertTriangle, ArrowRight, CheckCircle2, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { LifecycleChart } from '../components/charts';
import { Container, PageHeader } from '../components/layout/Layout';
import { DistrictGate, OptionIcons, ScenarioSliders, useOptionName } from '../components/planner';
import { AssumptionBadge, Badge, Card, CardTitle, IllustrativeBadge, Tile } from '../components/ui';
import type { OptionPlan } from '../engine/plan';
import { useData } from '../lib/data';
import { fmtINR, fmtNum, inrParts } from '../lib/format';
import { usePlan } from '../lib/hooks';
import { useAppStore } from '../store/useAppStore';

function OptionCard({ o, recommended, active }: { o: OptionPlan; recommended: boolean; active: boolean }) {
  const { t } = useTranslation();
  const name = useOptionName();
  const setSelected = useAppStore((s) => s.setSelectedOption);
  if (!o.available)
    return (
      <Card className="flex h-full flex-col gap-3 opacity-70">
        <div className="flex items-center gap-2">
          <OptionIcons id={o.id} />
          <h3 className="font-display text-base font-semibold">{name(o.id)}</h3>
        </div>
        <p className="text-sm text-muted">{t(o.reasonKey ?? 'options.unavailable.generic')}</p>
      </Card>
    );
  const L = o.life;
  const rows: [string, string][] = [
    [t('costs.card.capex'), fmtINR(L.capex.total)],
    [t('costs.card.npv'), fmtINR(L.npv)],
    [t('costs.card.nominal'), fmtINR(L.total20)],
    [t('costs.card.lcoe'), `₹${fmtNum(L.lcoe, 2)}/kWh`],
    [t('costs.card.payback'), L.paybackVsDiesel ? t('costs.card.year', { y: L.paybackVsDiesel }) : t('costs.card.never')],
    [t('costs.card.paybackGrid'), L.paybackVsGrid ? t('costs.card.year', { y: L.paybackVsGrid }) : t('costs.card.never')],
    [t('costs.card.diesel'), `${fmtNum(L.dieselLitresYear1)} L`],
    [t('costs.card.rel'), `${fmtNum(o.sim.worstReliability * 100, 1)}%`],
  ];
  return (
    <Card selected={active} hover className={clsx('flex h-full flex-col gap-4', recommended && 'border-amber/50')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <OptionIcons id={o.id} />
          <h3 className="font-display text-base font-semibold">{name(o.id)}</h3>
        </div>
        {recommended && (
          <Badge tone="amber">
            <CheckCircle2 size={12} aria-hidden /> {t('costs.recommended')}
          </Badge>
        )}
      </div>
      <p className="num text-xs text-muted">
        {[
          o.spec.pvKwp > 0 && `${fmtNum(o.spec.pvKwp, 1)} kWp PV`,
          o.spec.batteryKwh > 0 && `${fmtNum(o.spec.batteryKwh, 0)} kWh`,
          o.spec.windKw > 0 && `${fmtNum(o.spec.windKw, 1)} kW wind`,
          o.spec.hydroKw > 0 && `${fmtNum(o.spec.hydroKw, 1)} kW hydro`,
          o.spec.dieselKva > 0 && `${fmtNum(o.spec.dieselKva, 1)} kVA DG`,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className={clsx('font-semibold text-text', /^[\d₹]/.test(v) ? 'num' : 'font-sans')}>{v}</dd>
          </div>
        ))}
      </dl>
      {!o.meetsTarget && (
        <p className="flex items-center gap-2 text-xs text-warning">
          <AlertTriangle size={14} aria-hidden /> {t('costs.belowTarget')}
        </p>
      )}
      {(o.spec.windKw > 0 || o.spec.hydroKw > 0) && <AssumptionBadge title={t('costs.localQuote')} />}
      <button className={clsx('mt-auto', active ? 'btn-secondary' : 'btn-ghost')} aria-pressed={active} onClick={() => setSelected(o.id)}>
        {active ? t('costs.showing') : t('costs.show')}
      </button>
    </Card>
  );
}

function CostsBody() {
  const { t } = useTranslation();
  const { district, plan, active } = usePlan();
  const { costsFile } = useData();
  const name = useOptionName();
  if (!district || !plan || !active || !costsFile) return null;
  const L = active.life;
  const cap = inrParts(L.capex.total);
  const npv = inrParts(L.npv);
  const keyItems = ['solar_capex_per_kw', 'lfp_capex_per_kwh', 'diesel_price_per_l', 'diesel_kwh_per_l', 'grid_tariff_per_kwh', 'om_escalation', 'discount_rate', 'wind_capex_per_kw', 'hydro_capex_per_kw', 'solar_degradation'];
  return (
    <>
      <PageHeader
        eyebrow={t('costs.eyebrow')}
        title={t('costs.title', { name: district.name })}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {t('costs.sub')} {district.illustrative && <IllustrativeBadge />}
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
          <Tile label={t('costs.tiles.capex')} prefix="₹" value={cap.value} digits={cap.digits} unit={cap.unit} accent="amber" sub={name(active.id)} />
          <Tile label={t('costs.tiles.npv')} prefix="₹" value={npv.value} digits={npv.digits} unit={npv.unit} sub={t('costs.tiles.npvSub', { r: fmtNum(L.discountRate * 100, 2) })} />
          <Tile label={t('costs.tiles.lcoe')} prefix="₹" value={L.lcoe} digits={2} unit="/kWh" accent="mint" sub={t('costs.tiles.lcoeSub')} />
          <Tile label={t('costs.tiles.payback')} value={L.paybackVsDiesel ?? 0} unit={t('units.years')} accent="aqua" sub={L.paybackVsDiesel ? t('costs.tiles.paybackSub') : t('costs.card.never')} />
        </div>

        <section aria-labelledby="opts-h">
          <h2 id="opts-h" className="mb-3 font-display text-lg font-bold">
            {t('costs.options')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {plan.options.map((o) => (
              <OptionCard key={o.id} o={o} recommended={plan.recommended === o.id} active={active.id === o.id} />
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-12">
          <Card className="flex flex-col lg:col-span-8">
            <CardTitle right={<Badge>{name(active.id)}</Badge>}>{t('costs.lifecycle')}</CardTitle>
            <div className="min-h-[320px] flex-1">
              <LifecycleChart life={L} className="!h-full" />
            </div>
            <p className="mt-3 text-xs text-muted">{t('costs.lifecycleNote')}</p>
          </Card>
          <div className="lg:col-span-4">
            <ScenarioSliders showCosts />
          </div>
        </div>

        <Card>
          <CardTitle
            right={
              <Link to="/data#assumptions" className="flex items-center gap-1 text-sm text-aqua hover:underline">
                {t('costs.allAssumptions')} <ArrowRight size={14} aria-hidden />
              </Link>
            }
          >
            {t('costs.keyAssumptions')}
          </CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line/30 text-left text-xs text-muted">
                  <th className="py-2 font-medium">{t('data.item')}</th>
                  <th className="py-2 font-medium">{t('data.value')}</th>
                  <th className="py-2 font-medium">{t('data.kind')}</th>
                  <th className="py-2 font-medium">{t('data.source')}</th>
                </tr>
              </thead>
              <tbody>
                {keyItems.map((k) => {
                  const it = costsFile.items[k];
                  if (!it) return null;
                  const src = it.source ? costsFile.sources[it.source] : null;
                  return (
                    <tr key={k} className="border-b border-line/15">
                      <td className="py-2.5">{it.label}</td>
                      <td className="num py-2.5">
                        {it.unit.startsWith('₹') ? `₹${fmtNum(it.value, 2)}${it.unit.slice(1)}` : it.unit === 'per year' ? `${fmtNum(it.value * 100, 2)}% / yr` : `${fmtNum(it.value, 3)} ${it.unit}`}
                      </td>
                      <td className="py-2.5">{it.kind === 'sourced' ? <Badge tone="mint">{t('badges.sourced')}</Badge> : <AssumptionBadge title={it.detail} />}</td>
                      <td className="py-2.5 text-xs text-muted">
                        {src ? (
                          <a href={src.url} target="_blank" rel="noreferrer" className="text-aqua hover:underline">
                            {src.title}
                          </a>
                        ) : (
                          it.detail ?? t('data.ourAssumption')
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </Container>
    </>
  );
}

export default function Costs() {
  return (
    <DistrictGate>
      <CostsBody />
    </DistrictGate>
  );
}
