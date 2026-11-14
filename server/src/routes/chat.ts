import Anthropic from '@anthropic-ai/sdk';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

export const chat = Router();

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-opus-5-5';
const LANG_NAMES: Record<string, string> = { en: 'English', hi: 'Hindi', ta: 'Tamil', bn: 'Bengali' };

const SYSTEM = `You are the planning assistant inside India Energy Planner, a tool that helps panchayats, planners and citizens choose and cost power projects for Indian districts.

Answer only from the CONTEXT block the app sends: the selected district's profile, the user's current design and costs, the subsidy schemes and the FAQ. If the context doesn't contain the answer, say so plainly and suggest which page of the app to check. Don't invent numbers, phone numbers, scheme amounts or eligibility rules.

For any scheme or subsidy detail, end with "Verify on the official site before applying." Values marked illustrative or assumption are estimates; say so when you use them.

Keep answers short: two to five sentences, or a few bullets for comparisons. Use Indian number formats (lakh, crore) and ₹. Reply in the user's selected language.`;

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().min(1).max(4000) }))
    .min(1)
    .max(20)
    .refine((m) => m[0].role === 'user' && m[m.length - 1].role === 'user', 'conversation must start and end with a user message'),
  language: z.enum(['en', 'hi', 'ta', 'bn']).default('en'),
  context: z.string().max(60_000).default(''),
});

const limiter = rateLimit({ windowMs: 60_000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false });

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

/**
 * POST /api/chat → text/event-stream of `data: {"text": "..."}` chunks, then `data: {"done": true}`.
 * Failures before streaming return JSON `{code}` so the client falls back to FAQ search;
 * failures mid-stream send `data: {"error": code}`.
 */
chat.post('/', limiter, async (req, res) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ code: 'invalid_request' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ code: 'ai_not_configured' });

  const { messages, language, context } = parsed.data;
  const last = messages[messages.length - 1];
  const history = messages.slice(0, -1);
  const apiMessages: Anthropic.Beta.BetaMessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    {
      role: 'user',
      content: `<context>\n${context}\n</context>\n\nReply in ${LANG_NAMES[language]}.\n\n${last.content}`,
    },
  ];

  let started = false;
  const send = (obj: unknown) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
  try {
    const stream = getClient().beta.messages.stream({
      model: MODEL,
      max_tokens: 4000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: apiMessages,
    } as Anthropic.Beta.MessageCreateParamsStreaming);
    stream.on('text', (text) => {
      if (!started) {
        started = true;
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' });
      }
      send({ text });
    });
    req.on('close', () => stream.abort());
    const final = await stream.finalMessage();
    if (!started) {
      // Nothing streamed (e.g. a refusal before any text): let the client fall back.
      return res.status(502).json({ code: final.stop_reason === 'refusal' ? 'ai_declined' : 'ai_empty' });
    }
    if (final.stop_reason === 'refusal') send({ error: 'ai_declined' });
    send({ done: true });
    res.end();
  } catch (err) {
    const code =
      err instanceof Anthropic.AuthenticationError
        ? 'ai_auth'
        : err instanceof Anthropic.RateLimitError
          ? 'ai_rate_limited'
          : err instanceof Anthropic.APIConnectionError
            ? 'ai_unreachable'
            : 'ai_error';
    if (!started) return res.status(503).json({ code });
    send({ error: code });
    res.end();
  }
});
