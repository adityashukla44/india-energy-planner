import { Compass } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { Container, PageHeader } from '../components/layout/Layout';
import { AssumptionBadge, Badge, Card, CardTitle, EmptyState } from '../components/ui';
import { useData } from '../lib/data';
import { fmtNum } from '../lib/format';

export function NotFound() {
  const { t } = useTranslation();
  const loc = useLocation();
  return (
    <Container className="py-16">
      <Card className="mx-auto max-w-xl">
        <EmptyState
          icon={<Compass aria-hidden />}
          title={t('notFound.title')}
          body={t('notFound.body', { path: loc.pathname })}
          action={
            <Link to="/" className="btn-primary">
              {t('notFound.home')}
            </Link>
          }
        />
      </Card>
    </Container>
  );
}

const ENGINE_ASSUMPTIONS = ['monthly', 'storm', 'autonomy', 'greedy', 'diesel', 'hydro', 'wind', 'geothermal', 'growth', 'baseline', 'impact'] as const;

export function DataAssumptions() {
  const { t } = useTranslation();
  const { costsFile } = useData();
  return (
    <>
      <PageHeader eyebrow={t('data.eyebrow')} title={t('data.title')} sub={t('data.sub')} />
      <Container className="mt-6 space-y-6">
        <Card id="sources">
          <CardTitle>{t('data.sourcesTitle')}</CardTitle>
          <ul className="grid gap-2 text-sm md:grid-cols-2">
            {costsFile &&
              Object.entries(costsFile.sources).map(([k, s]) => (
                <li key={k}>
                  <a className="text-aqua hover:underline" href={s.url} target="_blank" rel="noreferrer">
                    {s.title}
                  </a>
                </li>
              ))}
            {(t('data.extraSources', { returnObjects: true }) as { title: string; url: string }[]).map((s) => (
              <li key={s.url}>
                <a className="text-aqua hover:underline" href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </Card>
        <Card id="assumptions">
          <CardTitle>{t('data.costsTitle')}</CardTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line/30 text-left text-xs text-muted">
                  <th className="py-2 font-medium">{t('data.item')}</th>
                  <th className="py-2 font-medium">{t('data.value')}</th>
                  <th className="py-2 font-medium">{t('data.kind')}</th>
                  <th className="py-2 font-medium">{t('data.source')}</th>
                </tr>
              </thead>
              <tbody>
                {costsFile &&
                  Object.entries(costsFile.items).map(([k, it]) => {
                    const src = it.source ? costsFile.sources[it.source] : null;
                    return (
                      <tr key={k} className="border-b border-line/15 align-top">
                        <td className="py-2.5 pr-3">
                          {it.label}
                          <code className="ml-2 font-mono text-[11px] text-muted">{k}</code>
                        </td>
                        <td className="num py-2.5 pr-3">
                          {fmtNum(it.value, 4)} <span className="text-muted">{it.unit}</span>
                          {it.min !== undefined && <span className="block text-xs text-muted">{t('data.range', { min: fmtNum(it.min, 2), max: fmtNum(it.max ?? 0, 2) })}</span>}
                        </td>
                        <td className="py-2.5 pr-3">{it.kind === 'sourced' ? <Badge tone="mint">{t('badges.sourced')}</Badge> : <AssumptionBadge title={it.detail} />}</td>
                        <td className="py-2.5 text-xs text-muted">
                          {src ? (
                            <a href={src.url} target="_blank" rel="noreferrer" className="text-aqua hover:underline">
                              {src.title}
                            </a>
                          ) : (
                            t('data.ourAssumption')
                          )}
                          {it.detail && <span className="block">{it.detail}</span>}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card id="engine">
            <CardTitle>{t('data.engineTitle')}</CardTitle>
            <ul className="list-disc space-y-2 pl-5 text-sm text-muted">
              {ENGINE_ASSUMPTIONS.map((k) => (
                <li key={k}>{t(`data.engine.${k}`)}</li>
              ))}
            </ul>
          </Card>
          <div className="space-y-6">
            <Card id="districts">
              <CardTitle>{t('data.districtsTitle')}</CardTitle>
              <p className="text-sm text-muted">{t('data.districtsBody')}</p>
            </Card>
            <Card id="boundary" className="border-amber/40">
              <CardTitle>{t('data.boundaryTitle')}</CardTitle>
              <p className="text-sm text-muted">{t('data.boundaryBody')}</p>
              <p className="mt-3">
                <Badge tone="amber">{t('data.verify')}</Badge>
              </p>
            </Card>
          </div>
        </div>
      </Container>
    </>
  );
}
