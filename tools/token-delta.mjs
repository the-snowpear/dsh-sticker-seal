#!/usr/bin/env node
// Volume receipt: measures the token footprint of the local injection text by
// sending it as `instructions` through the relay and subtracting the baseline
// call's input_tokens. The relay's own injection is present in BOTH calls, so it
// cancels out and the delta is the local text's cost.
//
// Usage: node tools/token-delta.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const URL_ = 'https://api.postboxcenter.xyz/v1/responses';
const MODEL = 'deepseek-v4.1-flash';

const cred = fs.readFileSync(path.join(process.env.USERPROFILE || os.homedir(), '.dsh', '.credentials.yaml'), 'utf8');
const key = cred.match(/^\s*SCNET_API_KEY:\s*(\S+)\s*$/m)?.[1];
if (!key) {
  console.error('KEY_NOT_FOUND');
  process.exit(2);
}

const prefix = fs.readFileSync(path.join(ROOT, 'injection', 'prefix.md'), 'utf8');
const suffix = fs.readFileSync(path.join(ROOT, 'injection', 'suffix.md'), 'utf8');
const local = prefix + '\n' + suffix;

async function call(instructions) {
  const body = {
    model: MODEL,
    max_output_tokens: 16,
    instructions,
    input: 'PING',
  };
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!j.usage) throw new Error('no usage: ' + JSON.stringify(j).slice(0, 200));
  return j.usage;
}

const base = await call('');
const withLocal = await call(local);

const delta = withLocal.input_tokens - base.input_tokens;
const RELAY_FOOTPRINT = 5362; // measured: bare call input_tokens 5370 minus an 8-token payload
const chars = local.length;
const ratio = chars / delta;

console.log(JSON.stringify({
  baseline_input_tokens: base.input_tokens,
  baseline_cached: base.input_tokens_details?.cached_tokens ?? null,
  with_local_input_tokens: withLocal.input_tokens,
  with_local_cached: withLocal.input_tokens_details?.cached_tokens ?? null,
  local_text_chars: chars,
  local_text_tokens: delta,
  chars_per_token: Number(ratio.toFixed(2)),
  relay_footprint_tokens: RELAY_FOOTPRINT,
  deviation_from_relay: delta - RELAY_FOOTPRINT,
  verdict: Math.abs(delta - RELAY_FOOTPRINT) <= 120 ? 'MATCH' : 'DRIFT',
}, null, 2));

process.exit(Math.abs(delta - RELAY_FOOTPRINT) <= 120 ? 0 : 1);
