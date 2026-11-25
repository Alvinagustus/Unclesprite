#!/usr/bin/env node
// server.ts — live demo endpoint for UncleSprite.
// Runs INSIDE a Fly.io Sprite: a tiny HTTP server judges can hit in a browser.
// No provider keys ever enter the VM — all external access via the Connector
// Gateway. The server only accepts a public issue ref and returns the verdict.
//
// GET  /         -> HTML form (enter owner/repo#N)
// POST /review   -> run the golden path, render verdict + grudge
// GET  /healthz  -> "ok"
//
// Env: GITHUB_CONN_ID (required), OPENROUTER_CONN_ID, PINECONE_CONN_ID, PORT.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { gatewayConfigFromEnv } from "./gateway.js";
import { scanEnvForSecrets } from "./bunker.js";
import { fetchIssue } from "./connectors.js";
import { addGrudge, recall } from "./memory.js";
import { produceVerdict } from "./verdict.js";
import { paranoidOpener } from "./persona.js";

const PORT = Number(process.env.PORT ?? 8080);
const MAX_BODY = 2048; // bytes — reject oversized input
const WINDOW_MS = 60_000; // rate-limit window
const MAX_PER_WINDOW = 8; // requests per IP per window

// --- tiny in-memory rate limiter (per IP) ---
const hits = new Map<string, { count: number; reset: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now > e.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  e.count += 1;
  return e.count > MAX_PER_WINDOW;
}

// Strict issue ref: owner/repo#N or a github.com/.../issues/N URL.
function parseIssueRef(task: string): { owner: string; repo: string; number: number } | null {
  const url = task.match(/github\.com\/([\w.-]+)\/([\w.-]+)\/issues\/(\d+)/);
  if (url) return { owner: url[1], repo: url[2], number: Number(url[3]) };
  const short = task.match(/^([\w.-]+)\/([\w.-]+)#(\d+)$/);
  if (short) return { owner: short[1], repo: short[2], number: Number(short[3]) };
  return null;
}

function grudgeId(task: string, what: string): string {
  const s = `${task}|${what}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `grudge-${h.toString(16)}`;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:ui-monospace,Menlo,Consolas,monospace;max-width:720px;margin:40px auto;padding:0 16px;background:#0d1117;color:#e6edf3}
h1{font-size:1.4rem}form{display:flex;gap:8px;flex-wrap:wrap}input{flex:1;padding:10px;border:1px solid #30363d;border-radius:6px;background:#161b22;color:#e6edf3}
button{padding:10px 16px;border:0;border-radius:6px;background:#238636;color:#fff;cursor:pointer}pre{white-space:pre-wrap;background:#161b22;border:1px solid #30363d;border-radius:6px;padding:14px;overflow:auto}
.small{color:#8b949e;font-size:.85rem}</style></head><body>${body}</body></html>`;
}

const FORM = (err = "") =>
  page("🦃 UncleSprite", `
<h1>🦃 UncleSprite</h1>
<p class="small">Paranoid agent in a Fly.io Sprite bunker. Enter a public issue ref — it reviews it and posts a verdict. No API keys in the VM; all access via connectors.</p>
${err ? `<p style="color:#f85149">${err}</p>` : ""}
<form method="POST" action="/review">
  <input name="issue" placeholder="owner/repo#1" required pattern="[^\\s]+/[^\\s]+#[0-9]+">
  <button type="submit">Review</button>
</form>
<p class="small">GET /healthz · <a href="https://github.com/Alvinagustus/Unclesprite" style="color:#58a6ff">source</a></p>`);

async function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((resolve) => {
    let data = "";
    let tooBig = false;
    req.on("data", (c) => {
      data += c;
      if (data.length > MAX_BODY) {
        tooBig = true;
        req.destroy();
      }
    });
    req.on("end", () => resolve(tooBig ? null : data));
    req.on("error", () => resolve(null));
  });
}

async function runReview(task: string): Promise<string> {
  const cfg = gatewayConfigFromEnv();
  const ref = parseIssueRef(task);
  if (!ref) return "Invalid issue ref. Use owner/repo#N.";

  // Zero-trust: refuse to run if a provider key leaked into the env.
  const zt = scanEnvForSecrets();
  if (!zt.clean) return `ALARM: secrets in env (${zt.offenders.join(", ")}) — refusing.`;

  const lines: string[] = [];
  lines.push(paranoidOpener(task.length));
  lines.push(`[zero-trust] scanned ${zt.scanned} env vars — ZERO provider keys.`);

  const res = await fetchIssue(cfg, ref.owner, ref.repo, ref.number);
  if (!res.ok) return lines.join("\n") + `\n[github] fetch failed (${res.status}) — is the issue public?`;

  let state = task;
  const findings: string[] = [];
  let clean = true;
  try {
    const issue = JSON.parse(res.body);
    lines.push(`[github] fetched #${ref.number}: "${issue.title}"`);
    state = `${issue.title}\n${issue.body ?? ""}`;
    if (/console\.log|TODO|FIXME/i.test(issue.body ?? "")) {
      findings.push("issue body contains TODO/FIXME/console.log markers");
      clean = false;
    }
    if ((issue.body ?? "").trim().length < 20) {
      findings.push("issue body is suspiciously short");
      clean = false;
    }
  } catch {
    return lines.join("\n") + "\n[github] could not parse issue JSON.";
  }

  const grudges = await recall(cfg, task);
  if (grudges.length > 0) lines.push(`[memory] I remember ${grudges.length} grudge(s)...`);

  const verdict = await produceVerdict(cfg, { task, state, clean, findings, grudges, mood: { paranoid: true, grudges: grudges.length } });
  lines.push(`[verdict:${verdict.source}]`);
  if (verdict.decision) {
    const d = verdict.decision;
    lines.push(`[jev] todo=${d.hasUnresolvedTodo ?? "?"} risk=${d.hasSecurityRisk ?? "?"} readiness=${d.readiness ?? "?"} category=${d.category ?? "?"} conf=${d.confidence?.toFixed(2) ?? "?"}`);
  }
  lines.push(verdict.text);

  if (findings.length > 0) {
    const where = await addGrudge(cfg, { id: grudgeId(task, findings[0]), when: "today", what: findings[0] });
    lines.push(`[memory] grudge saved to ${where}`);
  }
  return lines.join("\n");
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const ip = req.socket.remoteAddress ?? "unknown";
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (url.pathname === "/healthz") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }

  if (rateLimited(ip)) {
    res.writeHead(429, { "Content-Type": "text/html" });
    res.end(page("🦃 UncleSprite", "<h1>429 — too many requests</h1><p class='small'>Slow down, kid.</p>"));
    return;
  }

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(FORM());
    return;
  }

  if (req.method === "POST" && url.pathname === "/review") {
    const body = await readBody(req);
    if (body === null) {
      res.writeHead(413, { "Content-Type": "text/html" });
      res.end(FORM("Request too large."));
      return;
    }
    const issue = new URLSearchParams(body).get("issue")?.trim() ?? "";
    if (!parseIssueRef(issue)) {
      res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
      res.end(FORM("Invalid issue ref. Use owner/repo#N."));
      return;
    }
    let out: string;
    try {
      out = await runReview(issue);
    } catch (e) {
      out = `Internal error: ${(e as Error).message}`;
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(page("🦃 UncleSprite — verdict", `<h1>🦃 Verdict</h1><p class="small">${esc(issue)}</p><pre>${esc(out)}</pre><p class="small"><a href="/" style="color:#58a6ff">← review another</a></p>`));
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`🦃 UncleSprite server listening on :${PORT}`);
});