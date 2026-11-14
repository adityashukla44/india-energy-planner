import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Clock, Copy, ExternalLink, Phone, ShieldAlert, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Container, PageHeader } from '../components/layout/Layout';
import { Badge, Card, CardTitle, EmptyState, Skeleton } from '../components/ui';
import { toast } from '../components/ui/extras';
import { COMPLAINT_TYPES, STATUSES, fetchComplaints, myTickets, submitComplaint, useQueue, type ComplaintType, type PublicComplaint } from '../lib/complaints';
import { loadJson, useData } from '../lib/data';
import { fmtYm } from '../lib/format';
import { useAppStore } from '../store/useAppStore';

interface Helplines {
  verify_note: string;
  national: { id: string; label: string; number: string; note?: string; url?: string }[];
  states: { state: string; helplines: { label: string; number: string; url?: string }[]; discoms: { name: string; discom_number: string; url: string | null }[] }[];
}

const tel = (n: string) => `tel:${n.split('/')[0].replace(/[^\d+]/g, '')}`;

function NumberRow({ label, number, note, big }: { label: string; number: string; note?: string; big?: boolean }) {
  const { t } = useTranslation();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(number);
      toast(t('complaints.copied', { n: number }));
    } catch {
      toast(t('complaints.copyFailed'), 'error');
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 rounded-btn border border-line/30 p-3">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a href={tel(number)} className={clsx('num font-display font-extrabold text-aqua hover:underline', big ? 'text-xl' : 'text-lg')} aria-label={t('complaints.call', { label, number })}>
          {number}
        </a>
        <button onClick={copy} className="grid h-11 w-11 place-items-center rounded-btn border border-line/40 text-muted hover:text-aqua" aria-label={t('complaints.copy', { number })}>
          <Copy size={16} />
        </button>
        <a href={tel(number)} className="grid h-11 w-11 place-items-center rounded-btn bg-aqua/15 text-aqua" aria-label={t('complaints.call', { label, number })}>
          <Phone size={16} />
        </a>
      </div>
    </div>
  );
}

export function StatusChips({ status }: { status: string }) {
  const { t } = useTranslation();
  const idx = STATUSES.indexOf(status as (typeof STATUSES)[number]);
  return (
    <ol className="flex flex-wrap items-center gap-1" aria-label={t('complaints.statusAria', { s: t(`complaints.status.${status}`) })}>
      {STATUSES.map((s, i) => (
        <li key={s} className={clsx('chip', i <= idx ? (s === 'resolved' ? 'border-mint/50 bg-mint/15 text-mint' : 'border-aqua/50 bg-aqua/15 text-aqua') : 'border-line/40 text-muted')} aria-current={i === idx ? 'step' : undefined}>
          {i < idx || s === 'resolved' && i === idx ? <CheckCircle2 size={11} aria-hidden /> : null}
          {t(`complaints.status.${s}`)}
        </li>
      ))}
    </ol>
  );
}

export default function Complaints() {
  const { t } = useTranslation();
  const { districts } = useData();
  const selected = useAppStore((s) => s.selectedDistrictId);
  const pending = useQueue((s) => s.pending);
  const [help, setHelp] = useState<Helplines | null>(null);
  const sel = districts.find((d) => d.id === selected);
  const [state, setState] = useState(sel?.state ?? 'Delhi');
  const [form, setForm] = useState({ type: 'outage' as ComplaintType, district: sel?.id ?? '', details: '', contact: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [mine, setMine] = useState<PublicComplaint[] | null>(null);
  const [recent, setRecent] = useState<PublicComplaint[] | null>(null);
  const [listErr, setListErr] = useState(false);
  useEffect(() => {
    loadJson<Helplines>('helplines.json').then(setHelp, () => {});
  }, []);
  const stateDistricts = useMemo(() => districts.filter((d) => d.state === state), [districts, state]);
  useEffect(() => {
    if (!stateDistricts.some((d) => d.id === form.district)) setForm((f) => ({ ...f, district: stateDistricts[0]?.id ?? '' }));
  }, [stateDistricts]); // eslint-disable-line react-hooks/exhaustive-deps
  const loadLists = () => {
    const ids = myTickets();
    setListErr(false);
    (ids.length ? fetchComplaints({ ids: ids.join(',') }) : Promise.resolve([])).then(setMine, () => (setMine([]), setListErr(true)));
    fetchComplaints({ state }).then(setRecent, () => (setRecent([]), setListErr(true)));
  };
  useEffect(loadLists, [state, pending.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const stateInfo = help?.states.find((s) => s.state === state);
  const name = (id: string) => districts.find((d) => d.id === id)?.name ?? id;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.district) errs.district = t('complaints.errors.district');
    if (form.details.trim().length < 5) errs.details = t('complaints.errors.details');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSending(true);
    try {
      const r = await submitComplaint({ ...form, state, contact: form.contact || undefined });
      if (r.queued) toast(t('complaints.queued'));
      else toast(t('complaints.logged', { id: r.ticketId }));
      setForm((f) => ({ ...f, details: '', contact: '' }));
      loadLists();
    } catch {
      toast(t('complaints.errors.server'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <PageHeader eyebrow={t('complaints.eyebrow')} title={t('complaints.title')} sub={t('complaints.sub')} />
      <Container className="mt-6 space-y-6">
        <Card role="note" className="flex items-start gap-3 border-critical/50">
          <ShieldAlert className="mt-0.5 shrink-0 text-critical" aria-hidden />
          <p className="text-sm">{t('complaints.notice')}</p>
        </Card>

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-5">
            <Card>
              <CardTitle icon={<Phone size={18} />}>{t('complaints.national')}</CardTitle>
              {!help ? <Skeleton className="h-48" /> : <div className="space-y-2">{help.national.map((n) => <NumberRow key={n.id} label={n.label} number={n.number} note={n.note} big />)}</div>}
            </Card>
            <Card>
              <CardTitle>{t('complaints.stateHelp')}</CardTitle>
              <label className="mb-3 flex flex-col gap-1 text-xs font-medium text-muted">
                {t('subsidies.state')}
                <select className="field" value={state} onChange={(e) => setState(e.target.value)}>
                  {help?.states.map((s) => <option key={s.state} value={s.state}>{s.state}</option>)}
                </select>
              </label>
              {stateInfo && (
                <div className="space-y-2">
                  {stateInfo.helplines.map((h) => <NumberRow key={h.label + h.number} label={h.label} number={h.number} />)}
                  {stateInfo.discoms.map((d) => (
                    <div key={d.name} className="flex items-center justify-between gap-3 rounded-btn border border-dashed border-line/50 p-3 text-sm">
                      <div>
                        <p>{d.name}</p>
                        <p className="text-xs text-warning">{t('complaints.toVerify')}</p>
                      </div>
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noreferrer" className="btn-ghost min-h-[40px] shrink-0 text-xs">
                          {t('complaints.website')} <ExternalLink size={13} aria-hidden />
                        </a>
                      ) : (
                        <span className="text-xs text-muted">{t('complaints.websiteVerify')}</span>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted">{help?.verify_note}</p>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6 lg:col-span-7">
            <Card>
              <CardTitle>{t('complaints.form')}</CardTitle>
              <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit} noValidate>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  {t('complaints.type')}
                  <select className="field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ComplaintType })}>
                    {COMPLAINT_TYPES.map((x) => <option key={x} value={x}>{t(`complaints.types.${x}`)}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                  {t('subsidies.state')}
                  <select className="field" value={state} onChange={(e) => setState(e.target.value)}>
                    {help?.states.map((s) => <option key={s.state} value={s.state}>{s.state}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted sm:col-span-2">
                  {t('complaints.district')}
                  <select className="field" value={form.district} aria-invalid={!!errors.district} aria-describedby={errors.district ? 'err-district' : undefined} onChange={(e) => setForm({ ...form, district: e.target.value })}>
                    {stateDistricts.length === 0 && <option value="">{t('complaints.noDistricts')}</option>}
                    {stateDistricts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {errors.district && <span id="err-district" className="text-critical">{errors.district}</span>}
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted sm:col-span-2">
                  {t('complaints.details')}
                  <textarea className="field min-h-[110px] py-2" maxLength={1000} value={form.details} aria-invalid={!!errors.details} aria-describedby={errors.details ? 'err-details' : undefined} placeholder={t('complaints.detailsPh')} onChange={(e) => setForm({ ...form, details: e.target.value })} />
                  {errors.details && <span id="err-details" className="text-critical">{errors.details}</span>}
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-muted sm:col-span-2">
                  {t('complaints.contact')}
                  <input className="field" maxLength={120} value={form.contact} placeholder={t('complaints.contactPh')} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
                  <span>{t('complaints.contactNote')}</span>
                </label>
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <button className="btn-primary" disabled={sending}>{sending ? t('complaints.sending') : t('complaints.submit')}</button>
                  {!navigator.onLine && <span className="flex items-center gap-1 text-xs text-warning"><WifiOff size={14} aria-hidden /> {t('complaints.offlineHint')}</span>}
                </div>
              </form>
            </Card>

            <Card>
              <CardTitle>{t('complaints.mine')}</CardTitle>
              {pending.map((p) => (
                <div key={p.clientId} className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-btn border border-amber/40 p-3 text-sm">
                  <span>{t(`complaints.types.${p.type}`)} · {name(p.district)}</span>
                  <Badge tone="amber"><Clock size={11} aria-hidden /> {t('complaints.waiting')}</Badge>
                </div>
              ))}
              {mine === null ? <Skeleton className="h-20" /> : mine.length === 0 && pending.length === 0 ? <p className="text-sm text-muted">{t('complaints.mineEmpty')}</p> : (
                <ul className="space-y-2">
                  {mine.map((c) => (
                    <li key={c.ticketId} className="rounded-btn border border-line/30 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="num text-sm font-semibold text-aqua">{c.ticketId}</span>
                        <span className="text-xs text-muted">{t(`complaints.types.${c.type}`)} · {name(c.district)}</span>
                      </div>
                      <div className="mt-2"><StatusChips status={c.status} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardTitle>{t('complaints.recent', { state })}</CardTitle>
              {listErr && <p className="mb-2 flex items-center gap-2 text-xs text-warning"><AlertTriangle size={14} aria-hidden /> {t('complaints.listError')}</p>}
              {recent === null ? <Skeleton className="h-32" /> : recent.length === 0 ? <EmptyState title={t('complaints.recentEmpty')} /> : (
                <ul className="divide-y divide-line/20">
                  {recent.slice(0, 12).map((c) => (
                    <li key={c.ticketId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                      <span className="flex items-center gap-2">
                        {c.sample && <Badge tone="sample">{t('heatmap.sample')}</Badge>}
                        {t(`complaints.types.${c.type}`)} · {name(c.district)}
                        <span className="text-xs text-muted">{fmtYm(c.createdAt.slice(0, 7))}</span>
                      </span>
                      <Badge tone={c.status === 'resolved' ? 'mint' : 'aqua'}>{t(`complaints.status.${c.status}`)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </Container>
    </>
  );
}
