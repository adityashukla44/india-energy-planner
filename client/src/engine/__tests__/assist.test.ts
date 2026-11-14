import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetAiCheck, searchFaq, streamChat, type Faq } from '../../lib/assist';

const faqs: Faq[] = JSON.parse(readFileSync(new URL('../../../public/data/faq.json', import.meta.url), 'utf8'));

describe('FAQ', () => {
  it('has at least 25 questions, each translated into Hindi, Tamil and Bengali', () => {
    expect(faqs.length).toBeGreaterThanOrEqual(25);
    for (const f of faqs) for (const l of ['en', 'hi', 'ta', 'bn']) expect(f.q[l], `${f.id}.${l}`).toBeTruthy();
  });
  it('finds the right answer first', () => {
    expect(searchFaq(faqs, 'How much subsidy can a 3 kW home get?')[0].id).toBe('pmsg');
    expect(searchFaq(faqs, 'is kusum open for my pump')[0].id).toBe('kusum');
    expect(searchFaq(faqs, 'battery lead acid or lfp')[0].id).toBe('cost-battery');
    expect(searchFaq(faqs, 'मेरी बिजली कटौती', 'hi')[0].id).toBe('complaint');
  });
  it('returns nothing for gibberish', () => {
    expect(searchFaq(faqs, 'zzqx vvbn')).toHaveLength(0);
  });
});

const sse = (chunks: string[]) =>
  new Response(new ReadableStream({ start(c) { for (const x of chunks) c.enqueue(new TextEncoder().encode(x)); c.close(); } }), { headers: { 'content-type': 'text/event-stream' } });

describe('chat streaming', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetAiCheck();
  });
  const health = (ai: boolean) => new Response(JSON.stringify({ ok: true, ai }), { headers: { 'content-type': 'application/json' } });
  /** Routes /api/health to `ai`, everything else to `chat`. */
  const route = (ai: boolean, chat: () => Promise<Response>) => vi.fn(async (url: string) => (String(url).endsWith('/api/health') ? health(ai) : chat()));
  it('joins streamed text, even when events split across chunks', async () => {
    vi.stubGlobal('fetch', route(true, async () => sse(['data: {"text":"Hel', 'lo"}\n\ndata: {"text":" there"}\n\n', 'data: {"done":true}\n\n'])));
    let out = '';
    await streamChat([{ role: 'user', content: 'hi' }], 'en', '', (t) => (out += t));
    expect(out).toBe('Hello there');
  });
  it('throws the server fallback code when AI is unavailable', async () => {
    vi.stubGlobal('fetch', route(true, async () => new Response(JSON.stringify({ code: 'ai_rate_limited' }), { status: 503, headers: { 'content-type': 'application/json' } })));
    await expect(streamChat([{ role: 'user', content: 'hi' }], 'en', '', () => {})).rejects.toThrow('ai_rate_limited');
  });
  it('does not call the chat endpoint when AI is not configured', async () => {
    const chat = vi.fn(async () => sse([]));
    vi.stubGlobal('fetch', route(false, chat));
    await expect(streamChat([{ role: 'user', content: 'hi' }], 'en', '', () => {})).rejects.toThrow('ai_not_configured');
    expect(chat).not.toHaveBeenCalled();
  });
  it('throws when the network is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    await expect(streamChat([{ role: 'user', content: 'hi' }], 'en', '', () => {})).rejects.toThrow('ai_unreachable');
  });
});
