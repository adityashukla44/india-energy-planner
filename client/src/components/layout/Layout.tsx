import clsx from 'clsx';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  Calculator,
  CalendarRange,
  Flame,
  Gauge,
  HelpCircle,
  Home as HomeIcon,
  Landmark,
  Languages,
  LayoutGrid,
  Map as MapIcon,
  MapPin,
  MessageSquareWarning,
  Moon,
  SlidersHorizontal,
  Sun,
  X,
  Zap,
} from 'lucide-react';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LANGUAGES } from '../../i18n';
import { useDistrict } from '../../lib/data';
import { useAppStore, type Lang } from '../../store/useAppStore';
import { Skeleton } from '../ui';
import { toast, Toaster } from '../ui/extras';
import { installSync } from '../../lib/complaints';

export const NAV = [
  { to: '/', key: 'home', icon: HomeIcon, end: true },
  { to: '/map', key: 'map', icon: MapIcon },
  { to: '/planner', key: 'planner', icon: SlidersHorizontal },
  { to: '/costs', key: 'costs', icon: Calculator },
  { to: '/rollout', key: 'rollout', icon: CalendarRange },
  { to: '/impact', key: 'impact', icon: Gauge },
  { to: '/subsidies', key: 'subsidies', icon: Landmark },
  { to: '/help', key: 'help', icon: HelpCircle },
  { to: '/complaints', key: 'complaints', icon: MessageSquareWarning },
  { to: '/heatmap', key: 'heatmap', icon: Flame },
] as const;

function Logo() {
  const { t } = useTranslation();
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label={t('app.name')}>
      <span className="grid h-9 w-9 place-items-center rounded-[11px] bg-gradient-to-br from-teal-deep to-aqua shadow-glow">
        <Zap size={18} className="text-amber" fill="currentColor" aria-hidden />
      </span>
      <span className="hidden font-display text-[15px] font-bold leading-tight sm:block">
        {t('app.short1')}
        <span className="block text-[11px] font-medium tracking-wide text-muted">{t('app.short2')}</span>
      </span>
    </Link>
  );
}

function ThemeToggle() {
  const { t } = useTranslation();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const next = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      className="grid h-11 w-11 place-items-center rounded-btn border border-line/50 text-muted hover:border-aqua/60 hover:text-aqua"
      aria-label={t(next === 'light' ? 'nav.lightMode' : 'nav.darkMode')}
      title={t(next === 'light' ? 'nav.lightMode' : 'nav.darkMode')}
      onClick={() => setTheme(next)}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function LanguageSwitch() {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  return (
    <label className="relative flex h-11 items-center gap-1.5 rounded-btn border border-line/50 pl-2.5 pr-1 text-muted focus-within:border-cyan hover:border-aqua/60">
      <Languages size={16} aria-hidden />
      <span className="sr-only">{t('nav.language')}</span>
      <select
        value={lang}
        onChange={(e) => setLanguage(e.target.value as Lang)}
        className="h-full cursor-pointer appearance-none bg-transparent pr-2 text-sm font-medium text-text focus:outline-none"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code} disabled={!l.ready} className="bg-panel text-text">
            {l.native} · {l.label}
            {!l.ready ? ` (${t('nav.soon')})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function DistrictChip() {
  const { t } = useTranslation();
  const d = useDistrict();
  const nav = useNavigate();
  return (
    <button
      onClick={() => nav('/map')}
      className={clsx(
        'flex h-11 max-w-[200px] items-center gap-2 rounded-btn border px-3 text-sm',
        d ? 'border-cyan/50 bg-cyan/10 text-text' : 'border-dashed border-line/70 text-muted',
      )}
      aria-label={d ? t('nav.districtChip', { name: d.name }) : t('nav.noDistrict')}
    >
      <MapPin size={15} className={d ? 'text-cyan' : ''} aria-hidden />
      <span className="truncate">{d ? d.name : t('nav.pickDistrict')}</span>
    </button>
  );
}

function Navbar() {
  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-40 border-b border-line/30" style={{ background: 'var(--panel-bg)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}>
      <a href="#main" className="sr-only-focusable absolute left-4 top-2 z-50 rounded-btn bg-amber px-4 py-2 text-on-accent">
        {t('nav.skip')}
      </a>
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 lg:px-6">
        <Logo />
        <nav aria-label={t('nav.main')} className="mx-2 hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={'end' in n ? n.end : undefined}
              className={({ isActive }) =>
                clsx(
                  'relative flex h-10 shrink-0 items-center rounded-[10px] px-2.5 text-[13px] font-medium transition-colors xl:px-3 xl:text-sm',
                  isActive ? 'text-aqua' : 'text-muted hover:text-text',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {t(`nav.${n.key}`)}
                  {isActive && <motion.span layoutId="nav-underline" className="absolute inset-x-2 -bottom-[13px] h-[2px] rounded-full bg-aqua shadow-glow" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <DistrictChip />
          <div className="hidden sm:block">
            <LanguageSwitch />
          </div>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/** Phone: bottom tab bar with the four main pages + a "More" sheet. */
function BottomTabs() {
  const { t } = useTranslation();
  const [more, setMore] = useState(false);
  const loc = useLocation();
  useEffect(() => setMore(false), [loc.pathname]);
  const main = NAV.slice(0, 4);
  const rest = NAV.slice(4);
  return (
    <>
      <nav aria-label={t('nav.main')} className="glass safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 rounded-none border-x-0 border-b-0 lg:hidden">
        {main.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={'end' in n ? n.end : undefined}
            className={({ isActive }) => clsx('flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px]', isActive ? 'text-aqua' : 'text-muted')}
          >
            <n.icon size={20} aria-hidden />
            {t(`nav.${n.key}`)}
          </NavLink>
        ))}
        <button onClick={() => setMore(true)} className="flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] text-muted" aria-haspopup="dialog">
          <LayoutGrid size={20} aria-hidden />
          {t('nav.more')}
        </button>
      </nav>
      <AnimatePresence>
        {more && (
          <motion.div className="fixed inset-0 z-50 bg-black/50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMore(false)}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={t('nav.more')}
              className="glass safe-bottom absolute inset-x-0 bottom-0 rounded-t-card p-4"
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-display font-semibold">{t('nav.more')}</span>
                <button className="grid h-11 w-11 place-items-center text-muted" onClick={() => setMore(false)} aria-label={t('common.close')}>
                  <X size={20} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {rest.map((n) => (
                  <NavLink key={n.to} to={n.to} className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-btn border border-line/40 text-xs text-text">
                    <n.icon size={20} className="text-aqua" aria-hidden />
                    {t(`nav.${n.key}`)}
                  </NavLink>
                ))}
              </div>
              <div className="mt-4 sm:hidden">
                <LanguageSwitch />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="relative mt-20 border-t border-line/30 pb-24 lg:pb-0">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-aqua/60 to-transparent" />
      <div className="mx-auto grid max-w-[1440px] gap-10 px-4 pb-10 pt-14 md:grid-cols-[1.6fr_1fr_1.2fr] lg:px-6">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-md text-sm leading-relaxed text-muted">{t('footer.disclaimer')}</p>
        </div>
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-text">{t('footer.data')}</h2>
          <ul className="space-y-2 text-sm text-muted">
            <li>
              <Link className="hover:text-aqua" to="/data">
                {t('footer.sources')}
              </Link>
            </li>
            <li>
              <Link className="hover:text-aqua" to="/data#assumptions">
                {t('footer.assumptions')}
              </Link>
            </li>
            <li>
              <Link className="hover:text-aqua" to="/data#boundary">
                {t('footer.boundary')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-text">{t('footer.explore')}</h2>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted">
            {NAV.slice(1).map((n) => (
              <li key={n.to}>
                <Link className="hover:text-aqua" to={n.to}>
                  {t(`nav.${n.key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="border-t border-line/20">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-muted lg:px-6">
          <span>{t('footer.credit')}</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-mint shadow-[0_0_8px_rgb(var(--mint))]" aria-hidden />
            {t('app.name')}
          </span>
        </div>
      </div>
    </footer>
  );
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

export function PageFallback() {
  return (
    <div className="mx-auto max-w-[1440px] space-y-4 px-4 py-8 lg:px-6" aria-busy="true">
      <Skeleton className="h-28" />
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const reduced = useReducedMotion();
  const mainRef = useRef<HTMLElement>(null);
  const lang = useAppStore((s) => s.language);
  const { i18n, t } = useTranslation();
  useEffect(() => {
    installSync((n) => toast(t('complaints.synced', { count: n })));
  }, [t]);
  useEffect(() => {
    const ready = LANGUAGES.find((l) => l.code === lang)?.ready;
    void i18n.changeLanguage(ready ? lang : 'en');
    document.documentElement.lang = ready ? lang : 'en';
  }, [lang, i18n]);
  return (
    <div className="flex min-h-dvh flex-col">
      <ScrollTop />
      <Navbar />
      <main id="main" ref={mainRef} className="flex-1" tabIndex={-1}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={loc.pathname}
            initial={reduced ? { opacity: 1 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 1 } : { opacity: 0, y: -12 }}
            transition={{ duration: reduced ? 0 : 0.22, ease: 'easeOut' }}
          >
            <Suspense fallback={<PageFallback />}>{children}</Suspense>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <BottomTabs />
      <Toaster />
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, right, children }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-line/30">
      <div className="page-header-bg absolute inset-0 opacity-90" aria-hidden />
      <div className="absolute inset-0 opacity-[0.35] [background-image:radial-gradient(rgb(var(--aqua)/0.35)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden />
      <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" aria-hidden />
      <div className="relative mx-auto flex max-w-[1440px] flex-col gap-4 px-4 pb-8 pt-10 lg:flex-row lg:items-end lg:justify-between lg:px-6">
        <div className="max-w-3xl">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="font-display text-xl font-extrabold sm:text-2xl">{title}</h1>
          {sub && <div className="mt-2 text-base text-muted">{sub}</div>}
          {children}
        </div>
        {right && <div className="shrink-0">{right}</div>}
      </div>
    </section>
  );
}

export const Container = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={clsx('mx-auto max-w-[1440px] px-4 lg:px-6', className)}>{children}</div>
);
