import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { ArrowDown, ArrowRight, ExternalLink, MapPin } from 'lucide-react';
import { lazy, Suspense, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { Container, NAV } from '../components/layout/Layout';
import { Card, CountUp } from '../components/ui';
import { DistrictPicker } from '../components/ui/extras';
import { useData } from '../lib/data';
import { useAppStore } from '../store/useAppStore';

const ScrollIndiaMap = lazy(() => import('../three/ScrollIndiaMap'));
const HeroCrystal = lazy(() => import('../three/HeroCrystal'));

const SCROLL_STEPS = ['s1', 's2', 's3'] as const;
/** Scroll ranges (0..1) where each caption is shown, matching the map's stages. */
const CAPTION_RANGES: [number, number][] = [
  [0.12, 0.3],
  [0.3, 0.56],
  [0.56, 1],
];

const FIGURES = [
  { key: 'peak', value: 260.45, digits: 2, unit: 'GW', url: 'https://www.pulse.bot/energy/news/indias-peak-power-demand-hits-record-high-of-260-gw-b30e4968-2d2d-4f66-b61c-84e746052fbc/' },
  { key: 'meters', value: 7.24, digits: 2, unitKey: 'units.crore', url: 'https://www.tndindia.com/indias-smart-meter-population-at-7-24-crore-parliament/amp/' },
  { key: 'homes', value: 50, digits: 0, unitKey: 'units.lakhPlus', url: 'https://mercomindia.com/pm-surya-ghar-powers-5-million-homes-total-capacity-hits-15-gw' },
  { key: 'rooftop', value: 14.8, digits: 1, unit: 'GW', url: 'https://mercomindia.com/pm-surya-ghar-powers-5-million-homes-total-capacity-hits-15-gw' },
] as const;

const STEPS = ['pick', 'describe', 'design', 'price', 'rollout'] as const;

/** Opacity for a caption over [a, b]; the first stays visible at the top, the last stays at the end. */
function useFade(p: MotionValue<number>, a: number, b: number, first: boolean, last: boolean) {
  return useTransform(p, [a, a + 0.05, b - 0.05, b], [first ? 1 : 0, 1, 1, last ? 1 : 0]);
}

export default function Home() {
  const { t } = useTranslation();
  const { districts } = useData();
  const select = useAppStore((s) => s.selectDistrict);
  const nav = useNavigate();
  const reduced = useReducedMotion();
  const lang = useAppStore((s) => s.language);
  const scrollRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: scrollRef, offset: ['start start', 'end end'] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.14], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.16], [0, -90]);
  const heroScale = useTransform(scrollYProgress, [0, 0.16], [1, 1.06]);
  const heroPointer = useTransform(scrollYProgress, (v) => (v > 0.08 ? 'none' : 'auto'));
  const captionShade = useTransform(scrollYProgress, [0.1, 0.18], [0, 1]);
  const captionOpacity = CAPTION_RANGES.map(([a, b], i) => useFade(scrollYProgress, a, b, false, i === CAPTION_RANGES.length - 1)); // eslint-disable-line react-hooks/rules-of-hooks
  const captionY = CAPTION_RANGES.map(([a, b]) => useTransform(scrollYProgress, [a, a + 0.06, b - 0.06, b], [24, 0, 0, -24])); // eslint-disable-line react-hooks/rules-of-hooks
  const dotOpacity = CAPTION_RANGES.map(([a, b]) => useTransform(scrollYProgress, [a, a + 0.02, b - 0.02, b], [0.25, 1, 1, 0.25])); // eslint-disable-line react-hooks/rules-of-hooks
  const crystal = (
    <span className="relative mx-[0.015em] inline-block h-[0.74em] w-[0.74em] align-[-0.02em]">
      <Suspense fallback={<span className="absolute inset-[6%] rounded-full bg-gradient-to-br from-aqua via-teal to-amber" />}>
        <HeroCrystal className="absolute inset-[-22%]" label={t('home.crystalAria')} />
      </Suspense>
    </span>
  );
  const rise = (i: number) => (reduced ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.08 * i, duration: 0.5 } });
  return (
    <>
      {/* ---------- Hero over India; scrolling zooms into the map and lights it up ---------- */}
      <section ref={scrollRef} className={reduced ? 'relative' : 'relative h-[420vh]'} aria-label={t('home.scroll.eyebrow')}>
        <div className={reduced ? 'relative h-[calc(100dvh-64px)] min-h-[640px] overflow-hidden' : 'sticky top-16 h-[calc(100dvh-64px)] min-h-[560px] overflow-hidden'}>
          {districts.length > 0 && (
            <Suspense fallback={<div className="absolute inset-0 bg-bg" />}>
              <ScrollIndiaMap districts={districts} progress={scrollYProgress} className="absolute inset-0" />
            </Suspense>
          )}
          <div aria-hidden className="pointer-events-none absolute -right-48 -top-48 h-[640px] w-[640px] rounded-full bg-teal/25 blur-[150px]" />
          {/* Hero copy: sits over the map, floats up and fades as the zoom begins */}
          <motion.div style={reduced ? undefined : { opacity: heroOpacity, y: heroY, scale: heroScale, pointerEvents: heroPointer }} className="absolute inset-0 z-10 origin-top">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/50 to-bg/80 lg:bg-gradient-to-r lg:from-bg lg:via-bg/60 lg:to-transparent" />
            <Container className="relative flex h-full flex-col justify-center pb-16 pt-6">
              <div className="flex items-start justify-between gap-6">
                <motion.p {...rise(0)} className="eyebrow max-w-[18rem]">
                  {t('home.eyebrow')}
                </motion.p>
                <motion.p {...rise(1)} className="hidden max-w-[17rem] text-right text-sm text-muted md:block">
                  {t('home.sideNote')}
                </motion.p>
              </div>
              <h1 className="mt-6 font-display font-extrabold tracking-[-0.045em]">
                <span className="sr-only">
                  {t('home.title1')} {t('home.title2')}
                </span>
                <motion.span {...rise(1)} aria-hidden className="block whitespace-nowrap text-[clamp(4.2rem,16vw,14rem)] leading-[0.9] text-text [text-shadow:0_6px_36px_rgba(0,0,0,0.55)]">
                  {lang === 'en' ? (
                    <>
                      P{crystal}WER
                    </>
                  ) : (
                    <>
                      {t('home.bigWord')}
                      {crystal}
                    </>
                  )}
                </motion.span>
                <motion.span
                  {...rise(2)}
                  aria-hidden
                  className="block bg-gradient-to-r from-aqua via-cyan to-amber bg-clip-text pb-2 text-[clamp(2rem,6.2vw,5.8rem)] leading-[1] text-transparent"
                >
                  {t('home.bigLine2')}
                </motion.span>
              </h1>
              <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,34rem)_1fr] lg:items-end">
                <motion.p {...rise(3)} className="text-base text-muted sm:text-lg">
                  {t('home.sub')}
                </motion.p>
                <motion.div {...rise(4)} className="flex flex-wrap gap-3 lg:justify-end">
                  <Link to="/map" className="btn-primary px-6 text-base">
                    <MapPin size={18} aria-hidden /> {t('home.cta')}
                  </Link>
                  <Link to="/planner" className="btn-ghost px-5 backdrop-blur">
                    {t('home.cta2')} <ArrowRight size={16} aria-hidden />
                  </Link>
                </motion.div>
              </div>
              <motion.div {...rise(5)} className="mt-6 max-w-md">
                <p className="mb-2 block text-xs font-medium uppercase tracking-wide text-muted">{t('home.quick')}</p>
                <DistrictPicker
                  districts={districts}
                  placeholder={t('home.quickPlaceholder')}
                  onPick={(d) => {
                    select(d.id);
                    nav('/map');
                  }}
                />
              </motion.div>
            </Container>
            {!reduced && (
              <a
                href="#light-up-end"
                onClick={(e) => {
                  e.preventDefault();
                  window.scrollBy({ top: window.innerHeight * 0.9, behavior: 'smooth' });
                }}
                className="absolute bottom-5 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.18em] text-text/80 hover:text-text sm:text-xs"
              >
                {t('home.scrollHint')}
                <motion.span animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.6 }} className="grid h-10 w-10 place-items-center rounded-full border border-text/30 backdrop-blur">
                  <ArrowDown size={16} aria-hidden />
                </motion.span>
              </a>
            )}
          </motion.div>

          {/* Captions for the zoom stages */}
          {!reduced && (
            <>
              <motion.div aria-hidden style={{ opacity: captionShade }} className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent lg:bg-gradient-to-r lg:from-bg lg:via-bg/60 lg:to-transparent lg:to-70%" />
              <Container className="pointer-events-none relative flex h-full items-end pb-10 lg:items-center lg:pb-0">
                <div className="w-full max-w-md">
                  <motion.p style={{ opacity: captionShade }} className="eyebrow mb-4">
                    {t('home.scroll.eyebrow')}
                  </motion.p>
                  <div className="relative h-52 sm:h-44">
                    {SCROLL_STEPS.map((k, i) => (
                      <motion.div key={k} style={{ opacity: captionOpacity[i], y: captionY[i] }} className="absolute inset-0">
                        <p className="num text-sm text-aqua">0{i + 1} / 03</p>
                        <h2 className="mt-1 font-display text-[clamp(1.8rem,4vw,3rem)] font-extrabold leading-[1.05]">{t(`home.scroll.${k}.title`)}</h2>
                        <p className="mt-3 text-base text-muted">{t(`home.scroll.${k}.body`)}</p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </Container>
              <motion.div aria-hidden style={{ opacity: captionShade }} className="pointer-events-none absolute right-5 top-1/2 flex -translate-y-1/2 flex-col gap-3">
                {SCROLL_STEPS.map((k, i) => (
                  <motion.span key={k} style={{ opacity: dotOpacity[i] }} className="h-8 w-1 rounded-full bg-cyan shadow-glow" />
                ))}
              </motion.div>
            </>
          )}
        </div>
        <span id="light-up-end" />
      </section>

      {reduced && (
        <Container className="mt-12">
          <p className="eyebrow mb-4">{t('home.scroll.eyebrow')}</p>
          <ol className="grid gap-6 md:grid-cols-3">
            {SCROLL_STEPS.map((k) => (
              <li key={k}>
                <h2 className="font-display text-xl font-bold">{t(`home.scroll.${k}.title`)}</h2>
                <p className="mt-1 text-muted">{t(`home.scroll.${k}.body`)}</p>
              </li>
            ))}
          </ol>
        </Container>
      )}

      <Container className="relative mt-16">
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FIGURES.map((f) => (
            <li key={f.key}>
              <Card className="h-full">
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{t(`home.figures.${f.key}.label`)}</p>
                <p className="mt-2 flex items-baseline gap-1.5">
                  <CountUp value={f.value} digits={f.digits} className="font-display text-2xl font-extrabold text-aqua" />
                  <span className="text-base font-semibold text-text">{'unitKey' in f ? t(f.unitKey) : f.unit}</span>
                </p>
                <p className="mt-2 text-xs text-muted">
                  {t(`home.figures.${f.key}.date`)} ·{' '}
                  <a href={f.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-aqua hover:underline">
                    {t(`home.figures.${f.key}.source`)} <ExternalLink size={11} aria-hidden />
                  </a>
                </p>
              </Card>
            </li>
          ))}
        </ul>
      </Container>

      <Container className="mt-16">
        <p className="eyebrow">{t('home.howEyebrow')}</p>
        <h2 className="mt-2 font-display text-xl font-bold">{t('home.howTitle')}</h2>
        <ol className="relative mt-8 grid gap-6 md:grid-cols-5">
          <span className="absolute left-[11px] top-3 hidden h-[2px] w-[calc(100%-22px)] bg-gradient-to-r from-teal-deep via-aqua to-cyan md:block" aria-hidden />
          {STEPS.map((s, i) => (
            <li key={s} className="relative flex gap-4 md:flex-col md:gap-3">
              <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 border-cyan bg-bg shadow-glow">
                <span className="h-2 w-2 rounded-full bg-cyan" />
              </span>
              <div>
                <p className="num text-xs text-muted">0{i + 1}</p>
                <h3 className="font-display text-base font-semibold">{t(`home.steps.${s}.title`)}</h3>
                <p className="mt-1 text-sm text-muted">{t(`home.steps.${s}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>

      <Container className="mt-16">
        <p className="eyebrow">{t('home.sectionsEyebrow')}</p>
        <h2 className="mt-2 font-display text-xl font-bold">{t('home.sectionsTitle')}</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NAV.slice(1).map((n) => (
            <li key={n.to}>
              <Link to={n.to} className="card lift group flex h-full items-start gap-4 p-5 hover:border-aqua/50">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-btn bg-aqua/10 text-aqua">
                  <n.icon size={20} aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-display font-semibold">
                    {t(`nav.${n.key}`)}
                    <ArrowRight size={15} className="text-muted transition-transform group-hover:translate-x-1 group-hover:text-aqua" aria-hidden />
                  </span>
                  <span className="mt-1 block text-sm text-muted">{t(`home.cards.${n.key}`)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </>
  );
}
