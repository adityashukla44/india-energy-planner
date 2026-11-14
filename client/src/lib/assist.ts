import type { PlanResult, OptionPlan } from '../engine/plan';
import { mean } from '../engine/resource';
import type { SubsidiesFile } from '../engine/subsidy';
import type { District } from '../engine/types';

export interface Faq {
  id: string;
  cat: string;
  q: Record<string, string>;
  a: string;
  /** extra search keywords */
  tags?: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu, ' ');
const STOP = new Set(['the', 'a', 'an', 'is', 'are', 'do', 'does', 'how', 'what', 'why', 'when', 'my', 'i', 'to', 'of', 'in', 'for', 'and', 'or', 'it', 'can', 'be', 'on', 'this', 'which', 'much']);
const tokens = (s: string) => norm(s).split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w));

/** Simple keyword search over questions (all languages) and answers. */
export function searchFaq(faqs: Faq[], query: string, lang = 'en'): Faq[] {
  const q = tokens(query);
  if (!q.length) return faqs;
  const scored = faqs.map((f) => {
    const qText = norm(`${f.q[lang] ?? ''} ${f.q.en} ${f.tags ?? ''}`);
    const aText = norm(f.a);
    let score = 0;
    for (const w of q) {
      if (qText.includes(w)) score += 3;
      if (aText.includes(w)) score += 1;
    }
    return { f, score };
  });
  return scored.filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.f);
}

/** Compact context for the assistant: district, current design, costs, subsidies, FAQ. */
export function buildContext(opts: { district: District | null; plan: PlanResult | null; active: OptionPlan | null; subsidies: SubsidiesFile | null; faqs: Faq[] }): string {
  const { district: d, plan, active, subsidies, faqs } = opts;
  const parts: string[] = [];
  if (d)
    parts.push(
      `DISTRICT: ${d.name}, ${d.state} (${d.category}). Illustrative data: ${d.illustrative}. Avg solar ${mean(d.ghi_monthly).toFixed(2)} kWh/m²/day; wind ${mean(d.wind50m_monthly).toFixed(1)} m/s at 50 m; small hydro ${d.small_hydro_potential}; biomass ${d.biomass_potential}; geothermal ${d.geothermal_potential}; grid ${d.grid_access}; diesel dependence ${d.diesel_dependence}; population ~${d.population_est}; demand ~${d.demand_mwh_yr_est} MWh/yr.`,
    );
  else parts.push('DISTRICT: none selected.');
  if (plan && active) {
    parts.push(`DEMAND: ${plan.demand.totalKwhDay.toFixed(1)} kWh/day, peak ${plan.demand.peakKw.toFixed(1)} kW. Loads: ${plan.demand.loads.map((l) => `${l.kind} ${l.kwhDay.toFixed(1)} kWh/day`).join('; ')}.`);
    parts.push(`RECOMMENDED: ${plan.recommended ?? 'none'}. SHOWN: ${active.id}.`);
    for (const o of plan.options) {
      if (!o.available) {
        parts.push(`OPTION ${o.id}: not available (${o.reasonKey}).`);
        continue;
      }
      const L = o.life;
      parts.push(
        `OPTION ${o.id}: PV ${o.spec.pvKwp.toFixed(1)} kWp, battery ${o.spec.batteryKwh.toFixed(0)} kWh (${o.spec.chemistry}), wind ${o.spec.windKw} kW, hydro ${o.spec.hydroKw} kW, diesel gen ${o.spec.dieselKva} kVA; worst-month reliability ${(o.sim.worstReliability * 100).toFixed(1)}%; capex ₹${Math.round(L.capex.total)}; 20-yr NPV ₹${Math.round(L.npv)}; LCOE ₹${L.lcoe.toFixed(2)}/kWh; payback vs diesel ${L.paybackVsDiesel ?? 'none'} yr, vs grid ${L.paybackVsGrid ?? 'none'} yr; diesel ${Math.round(L.dieselLitresYear1)} L in year 1.`,
      );
    }
  }
  if (subsidies) {
    parts.push(`SUBSIDIES (${subsidies.transitionNote} ${subsidies.openQuestions.join(' ')}):`);
    for (const s of subsidies.schemes) parts.push(`- ${s.name} [${s.status}] for ${s.projectTypes.join('/')}, states ${s.states === 'all' ? 'all' : s.states.join(',')}: ${s.rules.join('; ')}. ${s.url}`);
  }
  parts.push('FAQ:');
  for (const f of faqs) parts.push(`Q: ${f.q.en} A: ${f.a}`);
  return parts.join('\n');
}

export type ChatMsg = { role: 'user' | 'assistant'; content: string };

let aiCheck: { at: number; ok: boolean } | null = null;
/** Asks /api/health whether the assistant is configured; cached for a minute. */
export async function aiAvailable(): Promise<boolean> {
  if (aiCheck && Date.now() - aiCheck.at < 60_000) return aiCheck.ok;
  try {
    const r = await fetch('/api/health');
    const ok = r.ok && (await r.json()).ai === true;
    aiCheck = { at: Date.now(), ok };
    return ok;
  } catch {
    throw new Error('ai_unreachable');
  }
}
/** For tests. */
export const resetAiCheck = () => {
  aiCheck = null;
};

/** Streams the assistant reply. Throws an Error whose message is a fallback code when the AI is unavailable. */
export async function streamChat(messages: ChatMsg[], language: string, context: string, onText: (t: string) => void, signal?: AbortSignal): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('offline');
  // Skip the request entirely when the server has no AI key (avoids a failed request in the console).
  if (!(await aiAvailable())) throw new Error('ai_not_configured');
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, language, context }),
    signal,
  }).catch(() => {
    throw new Error('ai_unreachable');
  });
  if (!res.ok || !res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.code ?? 'ai_error');
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let got = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 2);
      if (!line.startsWith('data:')) continue;
      const msg = JSON.parse(line.slice(5));
      if (msg.text) {
        got = true;
        onText(msg.text);
      }
      if (msg.error && !got) throw new Error(msg.error);
    }
  }
}
