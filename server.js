'use strict';
// StudyMate backend: zero dependencies (Node 18+). Serves the web app and proxies LLM calls
// so the API key never reaches the browser.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

try { // minimal .env loader
  for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {}

const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const PUBLIC = path.join(__dirname, 'public');
const MIME = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon'};
const hits = new Map(); // ip -> timestamps, simple in-memory rate limit

function rateLimited(ip, max = 20, windowMs = 60000) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < windowMs);
  list.push(now); hits.set(ip, list);
  return list.length > max;
}

function validate(body) {
  const m = body && body.messages;
  if (!Array.isArray(m) || m.length < 1 || m.length > 30) return 'messages must be an array of 1 to 30 items';
  let total = 0;
  for (const x of m) {
    if (!x || !['user', 'assistant'].includes(x.role) || typeof x.content !== 'string' || !x.content.trim()) return 'invalid message';
    total += x.content.length;
  }
  if (m[0].role !== 'user' || m[m.length - 1].role !== 'user') return 'conversation must start and end with a user message';
  return total > 40000 ? 'input is too long' : null;
}

function extractJson(text) {
  const t = String(text).replace(/```(?:json)?/gi, '').trim();
  const a = t.search(/[\[{]/), b = Math.max(t.lastIndexOf(']'), t.lastIndexOf('}'));
  if (a < 0 || b < a) throw new Error('no JSON found');
  return JSON.parse(t.slice(a, b + 1));
}

async function callClaude(messages, wantJson) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01'},
    body: JSON.stringify({model: MODEL, max_tokens: wantJson ? 3000 : 2000, messages,
      ...(wantJson && {system: 'Return only valid JSON. No prose and no markdown fences.'})}),
    signal: AbortSignal.timeout(55000)
  });
  if (!res.ok) {
    const e = new Error(`Anthropic API ${res.status}`);
    e.status = res.status; throw e;
  }
  const data = await res.json();
  return data.content.filter(c => c.type === 'text').map(c => c.text).join('');
}

function send(res, status, obj) {
  res.writeHead(status, {'Content-Type': 'application/json'});
  res.end(JSON.stringify(obj));
}

async function handleGenerate(req, res) {
  if (!process.env.ANTHROPIC_API_KEY) return send(res, 503, {code: 'not_configured', error: 'ANTHROPIC_API_KEY is not set'});
  if (rateLimited(req.socket.remoteAddress)) return send(res, 429, {code: 'rate_limited', error: 'Too many requests'});
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 200000) return send(res, 413, {error: 'Request too large'}); }
  let body; try { body = JSON.parse(raw); } catch { return send(res, 400, {error: 'Invalid JSON'}); }
  const bad = validate(body); if (bad) return send(res, 400, {error: bad});
  try {
    const text = await callClaude(body.messages, !!body.json);
    send(res, 200, body.json ? {json: extractJson(text)} : {text});
  } catch (e) {
    console.error('generate failed:', e.message);
    if (e.status === 401) return send(res, 503, {code: 'not_configured', error: 'The API key was rejected'});
    if (e.status === 429) return send(res, 429, {code: 'rate_limited', error: 'The AI is busy, try again shortly'});
    send(res, 502, {code: 'upstream_error', error: 'The AI request failed'});
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, {ok: true, model: MODEL, configured: !!process.env.ANTHROPIC_API_KEY});
  if (req.method === 'POST' && url.pathname === '/api/generate') return handleGenerate(req, res);
  if (req.method !== 'GET') return send(res, 405, {error: 'Method not allowed'});
  const file = path.join(PUBLIC, path.normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
  if (!file.startsWith(PUBLIC)) return send(res, 403, {error: 'Forbidden'});
  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, {error: 'Not found'});
    res.writeHead(200, {'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff'});
    res.end(data);
  });
});

if (require.main === module) server.listen(PORT, () => console.log(`StudyMate running at http://localhost:${PORT}`));
module.exports = {validate, extractJson, server};
