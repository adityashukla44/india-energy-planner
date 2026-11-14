import clsx from 'clsx';
import { Bot, ChevronDown, Search, Send, Sparkles, User } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Container, PageHeader } from '../components/layout/Layout';
import { Card, CardTitle, EmptyState, Segmented, Skeleton } from '../components/ui';
import type { SubsidiesFile } from '../engine/subsidy';
import { buildContext, searchFaq, streamChat, type ChatMsg, type Faq } from '../lib/assist';
import { loadJson } from '../lib/data';
import { usePlan } from '../lib/hooks';
import { useAppStore } from '../store/useAppStore';

const CATS = ['all', 'options', 'costs', 'results', 'subsidies', 'data', 'help'] as const;

interface Bubble extends ChatMsg {
  fallback?: Faq[];
  note?: string;
}

function ChatPanel({ faqs, subsidies }: { faqs: Faq[]; subsidies: SubsidiesFile | null }) {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.language);
  const { district, plan, active } = usePlan();
  const [msgs, setMsgs] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);
  useEffect(() => () => abort.current?.abort(), []);
  const ask = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput('');
    const history: ChatMsg[] = [...msgs.filter((m) => !m.fallback).map(({ role, content }) => ({ role, content })), { role: 'user', content: q }];
    setMsgs((m) => [...m, { role: 'user', content: q }, { role: 'assistant', content: '' }]);
    setBusy(true);
    abort.current = new AbortController();
    try {
      const ctx = buildContext({ district, plan, active, subsidies, faqs });
      await streamChat(history.slice(-10), lang, ctx, (chunk) =>
        setMsgs((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          copy[copy.length - 1] = { ...last, content: last.content + chunk };
          return copy;
        }), abort.current.signal);
    } catch (e) {
      const code = (e as Error).message;
      const hits = searchFaq(faqs, q, lang).slice(0, 3);
      setMsgs((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: 'assistant', content: '', fallback: hits, note: t(`help.fallback.${code === 'offline' ? 'offline' : code === 'ai_not_configured' ? 'notConfigured' : 'error'}`) };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  };
  const suggestions = [t('help.suggest.1'), t('help.suggest.2'), t('help.suggest.3')];
  return (
    <Card pad={false} className="flex h-[640px] flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line/30 p-4">
        <span className="grid h-10 w-10 place-items-center rounded-btn bg-aqua/15 text-aqua"><Sparkles size={18} aria-hidden /></span>
        <div>
          <h2 className="font-display text-base font-semibold">{t('help.chatTitle')}</h2>
          <p className="text-xs text-muted">{district ? t('help.chatSub', { name: district.name }) : t('help.chatSubNone')}</p>
        </div>
      </div>
      <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {msgs.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t('help.chatEmpty')}</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button key={s} className="chip min-h-[36px] border-line/60 px-3 text-left text-text hover:border-aqua" onClick={() => ask(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={clsx('flex gap-3', m.role === 'user' && 'flex-row-reverse')}>
            <span className={clsx('grid h-8 w-8 shrink-0 place-items-center rounded-full', m.role === 'user' ? 'bg-amber/20 text-amber' : 'bg-aqua/15 text-aqua')} aria-hidden>
              {m.role === 'user' ? <User size={15} /> : <Bot size={15} />}
            </span>
            <div className={clsx('max-w-[85%] rounded-card px-4 py-3 text-sm', m.role === 'user' ? 'bg-amber/10' : 'border border-line/30 bg-bg/40')}>
              <span className="sr-only">{m.role === 'user' ? t('help.you') : t('help.assistant')}: </span>
              {m.fallback ? (
                <div className="space-y-3">
                  <p className="text-xs text-warning">{m.note}</p>
                  {m.fallback.length ? (
                    m.fallback.map((f) => (
                      <div key={f.id}>
                        <p className="font-semibold">{f.q[useAppStore.getState().language] ?? f.q.en}</p>
                        <p className="mt-1 text-muted">{f.a}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted">{t('help.noMatch')}</p>
                  )}
                </div>
              ) : m.content ? (
                <p className="whitespace-pre-wrap">{m.content}</p>
              ) : (
                <span className="inline-flex gap-1" aria-label={t('help.thinking')}>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-aqua" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-aqua [animation-delay:150ms]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-aqua [animation-delay:300ms]" />
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <form
        className="flex gap-2 border-t border-line/30 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(input);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">{t('help.chatPlaceholder')}</label>
        <input id="chat-input" className="field" placeholder={t('help.chatPlaceholder')} value={input} onChange={(e) => setInput(e.target.value)} maxLength={1000} />
        <button className="btn-primary w-12 shrink-0 px-0" disabled={busy || !input.trim()} aria-label={t('help.send')}>
          <Send size={18} />
        </button>
      </form>
      <p className="px-4 pb-3 text-[11px] text-muted">{t('help.chatDisclaimer')}</p>
    </Card>
  );
}

export default function Help() {
  const { t } = useTranslation();
  const lang = useAppStore((s) => s.language);
  const [faqs, setFaqs] = useState<Faq[] | null>(null);
  const [subsidies, setSubsidies] = useState<SubsidiesFile | null>(null);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<(typeof CATS)[number]>('all');
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    loadJson<Faq[]>('faq.json').then(setFaqs, () => setFaqs([]));
    loadJson<SubsidiesFile>('subsidies.json').then(setSubsidies, () => {});
  }, []);
  const list = useMemo(() => {
    if (!faqs) return [];
    const base = cat === 'all' ? faqs : faqs.filter((f) => f.cat === cat);
    return q.trim() ? searchFaq(base, q, lang) : base;
  }, [faqs, q, cat, lang]);
  return (
    <>
      <PageHeader eyebrow={t('help.eyebrow')} title={t('help.title')} sub={t('help.sub')} />
      <Container className="mt-6 grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <Card>
            <CardTitle>{t('help.faqTitle', { n: faqs?.length ?? 0 })}</CardTitle>
            <div className="relative mb-3">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <label htmlFor="faq-search" className="sr-only">{t('help.search')}</label>
              <input id="faq-search" className="field pl-9" placeholder={t('help.search')} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <Segmented size="sm" label={t('help.category')} value={cat} onChange={setCat} options={CATS.map((c) => ({ value: c, label: t(`help.cats.${c}`) }))} />
            <div className="mt-4 divide-y divide-line/25">
              {!faqs && <Skeleton className="h-64" />}
              {faqs && list.length === 0 && <EmptyState icon={<Search aria-hidden />} title={t('help.noResults')} body={t('help.noResultsBody')} />}
              {list.map((f) => {
                const isOpen = open === f.id;
                return (
                  <div key={f.id}>
                    <h3>
                      <button className="flex min-h-[52px] w-full items-center justify-between gap-3 py-3 text-left text-sm font-medium hover:text-aqua" aria-expanded={isOpen} aria-controls={`faq-${f.id}`} onClick={() => setOpen(isOpen ? null : f.id)}>
                        {f.q[lang] ?? f.q.en}
                        <ChevronDown size={16} className={clsx('shrink-0 transition-transform', isOpen && 'rotate-180')} aria-hidden />
                      </button>
                    </h3>
                    {isOpen && (
                      <div id={`faq-${f.id}`} className="pb-4 text-sm text-muted">
                        {f.a}
                        {lang !== 'en' && <p className="mt-2 text-xs italic">{t('help.answerEnglish')}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
        <div className="lg:col-span-5">{faqs ? <ChatPanel faqs={faqs} subsidies={subsidies} /> : <Skeleton className="h-[640px]" />}</div>
      </Container>
    </>
  );
}
