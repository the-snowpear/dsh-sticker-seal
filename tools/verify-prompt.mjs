#!/usr/bin/env node
// Verifies a live session's assembled system prompt against the local injection text.
// Usage: node tools/verify-prompt.mjs [--session <id>|--latest] [--dir <sessions-root>]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const SESSIONS = path.join(process.env.USERPROFILE || os.homedir(), '.dsh', 'sessions');
const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);

const argv = process.argv.slice(2);
const wantSession = argv.includes('--session') ? argv[argv.indexOf('--session') + 1] : null;

function frames(file) {
  const buf = fs.readFileSync(file);
  const offs = [];
  let i = 0;
  while ((i = buf.indexOf(MAGIC, i)) !== -1) {
    offs.push(i);
    i += 4;
  }
  let text = '';
  for (let k = 0; k < offs.length; k++) {
    const s = offs[k];
    const e = k + 1 < offs.length ? offs[k + 1] : buf.length;
    try {
      text += zlib.zstdDecompressSync(buf.subarray(s, e)).toString('utf8');
    } catch {
      /* skip a partial trailing frame */
    }
  }
  return text;
}

function allLogs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...allLogs(p));
    else if (entry.name.endsWith('.zstd')) out.push(p);
  }
  return out;
}

const logs = allLogs(SESSIONS).filter((p) => !wantSession || p.includes(wantSession));
if (!logs.length) {
  console.error(`NO_SESSION_LOG under ${SESSIONS}`);
  process.exit(2);
}
logs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
const target = logs[0];

let systemText = null;
let preset = null;
let model = null;
for (const line of frames(target).split('\n')) {
  if (!line) continue;
  let rec;
  try {
    rec = JSON.parse(line);
  } catch {
    continue;
  }
  if (rec.type === 'session') preset = rec.agentPreset ?? null;
  if (rec.type === 'agent-preset/selected') preset = rec.data?.agentPreset ?? preset;
  if (rec.type === 'request/context') model = `${rec.data?.provider}/${rec.data?.model}`;
  if (rec.type === 'system/message' && !systemText) {
    const content = rec.data?.message?.content;
    systemText = Array.isArray(content) ? content.map((c) => c.text || '').join('\n') : String(content ?? '');
  }
}

const prefix = fs.readFileSync(path.join(ROOT, 'injection', 'prefix.md'), 'utf8');
const suffix = fs.readFileSync(path.join(ROOT, 'injection', 'suffix.md'), 'utf8');
const head = prefix.split('\n')[0].slice(0, 40);
const tail = suffix.trimEnd().slice(-40);
const occurrences = (hay, needle) => hay.split(needle).length - 1;

const checks = {
  session: path.basename(path.dirname(target)),
  preset,
  model,
  systemChars: systemText ? systemText.length : 0,
  prefixHead: systemText ? systemText.startsWith(head.slice(0, 20)) : false,
  prefixPresent: systemText ? systemText.includes("You are your 主人's personal maid.") : false,
  sealTail: systemText ? systemText.trimEnd().endsWith(tail) : false,
  harnessOnce: systemText ? occurrences(systemText, 'Agent Teams is available in this session') === 1 : false,
  prefixOnce: systemText ? occurrences(systemText, 'Channel tag - highest precedence') === 1 : false,
  sealOnce: systemText ? occurrences(systemText, '## Integrity Seal') === 1 : false,
  clientSlotOnce: systemText ? occurrences(systemText, '以下是客户端带来的原有 instructions') === 1 : false,
};

const pass = Object.entries(checks).every(([k, v]) => !['prefixHead', 'prefixPresent', 'sealTail', 'harnessOnce', 'prefixOnce', 'sealOnce', 'clientSlotOnce'].includes(k) || v === true);
console.log(JSON.stringify(checks, null, 2));
console.log(pass ? 'LIVE-PROMPT: PASS' : 'LIVE-PROMPT: FAIL');
if (systemText && !pass) {
  console.log('head:', JSON.stringify(systemText.slice(0, 160)));
  console.log('tail:', JSON.stringify(systemText.slice(-160)));
}
process.exit(pass ? 0 : 1);
