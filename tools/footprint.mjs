#!/usr/bin/env node
// Measures the token cost of injection/*.md on any OpenAI-compatible endpoint.
//
// Two calls: one with an empty system layer, one with the injection text as the
// system layer. The delta is the footprint — the price of the sticker.
//
// env:
//   FOOTPRINT_BASE_URL  e.g. https://api.example.com/v1
//   FOOTPRINT_MODEL     e.g. deepseek-chat
//   FOOTPRINT_KEY_ENV   name of the env var holding the API key (default FOOTPRINT_API_KEY)
//   FOOTPRINT_API       `responses` (default), `chat`, or `anthropic`
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const BASE = (process.env.FOOTPRINT_BASE_URL || '').replace(/\/$/, '');
const MODEL = process.env.FOOTPRINT_MODEL || '';
const KEY_ENV = process.env.FOOTPRINT_KEY_ENV || 'FOOTPRINT_API_KEY';
const API = process.env.FOOTPRINT_API || 'responses';
const KEY = process.env[KEY_ENV] || '';

const missing = [!BASE && 'FOOTPRINT_BASE_URL', !MODEL && 'FOOTPRINT_MODEL', !KEY && KEY_ENV].filter(Boolean);
if (missing.length) {
  console.error(`MISSING_ENV: ${missing.join(', ')}`);
  process.exit(2);
}

const prefix = fs.readFileSync(path.join(ROOT, 'injection', 'prefix.md'), 'utf8');
const suffix = fs.readFileSync(path.join(ROOT, 'injection', 'suffix.md'), 'utf8');
const injection = `${prefix}\n${suffix}`;

const tokens = (usage) => usage?.input_tokens ?? usage?.prompt_tokens ?? usage?.total_tokens ?? null;

async function call(systemText) {
  const isChat = API === 'chat';
  const isAnthropic = API === 'anthropic';
  const url = `${BASE}/${isAnthropic ? 'messages' : isChat ? 'chat/completions' : 'responses'}`;
  const body = isAnthropic
    ? {
        model: MODEL,
        max_tokens: 8,
        ...(systemText ? { system: systemText } : {}),
        messages: [{ role: 'user', content: 'PING' }],
      }
    : isChat
      ? {
          model: MODEL,
          max_tokens: 8,
          messages: [
            ...(systemText ? [{ role: 'system', content: systemText }] : []),
            { role: 'user', content: 'PING' },
          ],
        }
      : { model: MODEL, max_output_tokens: 8, instructions: systemText, input: 'PING' };

  const headers = isAnthropic
    ? { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' }
    : { 'content-type': 'application/json', authorization: `Bearer ${KEY}` };

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const payload = await response.json();
  const usage = payload?.usage;
  if (!usage) throw new Error(`no usage in response: ${JSON.stringify(payload).slice(0, 200)}`);
  return usage;
}

const baselineUsage = await call('');
const injectionUsage = await call(injection);
const base = tokens(baselineUsage);
const withText = tokens(injectionUsage);

const report = {
  endpoint: BASE,
  api: API,
  model: MODEL,
  baseline_input_tokens: base,
  with_injection_input_tokens: withText,
  injection_tokens: withText - base,
  injection_chars: injection.length,
  chars_per_token: Number((injection.length / (withText - base)).toFixed(2)),
  prefix_chars: prefix.length,
  suffix_chars: suffix.length,
  prefix_bytes: Buffer.byteLength(prefix),
  suffix_bytes: Buffer.byteLength(suffix),
};
console.log(JSON.stringify(report, null, 2));
process.exit(withText > base ? 0 : 1);
