import clsx from 'clsx';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { District } from '../engine/types';
import type { LayerValue } from '../lib/layers';
import { loadBoundary, project, ringsToPath, type BoundaryGeo } from './geo';

const K = 40;

/** Accessible 2D map: official boundary + state lines + focusable district points. Used as the 3D fallback. */
export function Map2D({
  districts,
  values,
  selectedId,
  onSelect,
  className,
  showArcs,
  compact,
}: {
  districts: District[];
  values?: Map<string, LayerValue>;
  selectedId?: string | null;
  onSelect?: (d: District) => void;
  className?: string;
  showArcs?: [string, string][];
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const [geo, setGeo] = useState<BoundaryGeo | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    loadBoundary().then(setGeo, () => setErr(true));
  }, []);
  const paths = useMemo(() => {
    if (!geo) return null;
    return { country: ringsToPath(geo.countryRings, K), states: geo.states.map((s) => ({ name: s.name, d: ringsToPath(s.rings, K) })) };
  }, [geo]);
  if (err) return <p className="p-6 text-sm text-muted">{t('map.boundaryError')}</p>;
  if (!geo || !paths) return <div className={clsx('skeleton rounded-card', className)} style={{ aspectRatio: '0.9' }} />;
  const { minX, maxX, minY, maxY } = geo.bounds;
  const pad = 12;
  const vb = `${minX * K - pad} ${-maxY * K - pad} ${(maxX - minX) * K + pad * 2} ${(maxY - minY) * K + pad * 2}`;
  const pos = (d: District) => {
    const [x, y] = project(d.lon, d.lat);
    return [x * K, -y * K] as const;
  };
  const byId = new Map(districts.map((d) => [d.id, d]));
  return (
    <svg viewBox={vb} className={clsx('h-auto w-full', className)} role="group" aria-label={t('map.mapAria')}>
      <defs>
        <filter id="m2d-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={paths.country} fill="rgb(var(--panel))" fillOpacity={0.95} stroke="rgb(var(--cyan))" strokeOpacity={0.8} strokeWidth={1.1} />
      <g fill="none" stroke="rgb(var(--aqua))" strokeOpacity={0.3} strokeWidth={0.6}>
        {paths.states.map((s) => (
          <path key={s.name} d={s.d}>
            <title>{s.name}</title>
          </path>
        ))}
      </g>
      {showArcs?.map(([a, b]) => {
        const da = byId.get(a);
        const db = byId.get(b);
        if (!da || !db) return null;
        const [x1, y1] = pos(da);
        const [x2, y2] = pos(db);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.25;
        return <path key={a + b} d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none" stroke="rgb(var(--cyan))" strokeOpacity={0.55} strokeWidth={1} strokeDasharray="3 4" />;
      })}
      {districts.map((d) => {
        const [x, y] = pos(d);
        const v = values?.get(d.id);
        const sel = d.id === selectedId;
        const r = compact ? 4 : 5 + (v ? v.v01 * 5 : 0);
        const label = `${d.name}, ${d.state}${v ? `: ${v.valueText}` : ''}`;
        return (
          <g
            key={d.id}
            transform={`translate(${x},${y})`}
            role={onSelect ? 'button' : 'img'}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={label}
            aria-pressed={onSelect ? sel : undefined}
            className={clsx(onSelect && 'cursor-pointer focus:outline-none [&:focus>circle.ring]:opacity-100')}
            onClick={() => onSelect?.(d)}
            onKeyDown={(e) => {
              if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onSelect(d);
              }
            }}
          >
            <title>{label}</title>
            <circle className="ring" r={r + 4} fill="none" stroke="rgb(var(--cyan))" strokeWidth={1.5} opacity={sel ? 1 : 0} />
            <circle r={r} fill={v?.color ?? 'rgb(var(--cyan))'} filter="url(#m2d-glow)" opacity={0.95} />
            {(sel || (!compact && !values)) && (
              <text y={-r - 6} textAnchor="middle" fontSize="11" className="fill-text font-sans" style={{ paintOrder: 'stroke' }} stroke="rgb(var(--bg))" strokeWidth={3}>
                {d.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
