// verdict.ts — produce the final verdict.
// Decision core: Jev (TypeSafe System One) via the OpenRouter connector.
//   Jev returns typed answers (noul / score / choice) + confidence — no LLM luck.
// Voice: deterministic Weird Uncle template bank (never fails).
// If Jev is unavailable, a heuristic fallback keeps the golden path alive.

import { jevDecide } from "./jev.js";
import type { GatewayConfig } from "./gateway.js";
import {
  verdictLine,
  categoryVerdict,
  grudgeOpener,
  grudgeCitation,
  lowConfidenceLine,
  type PersonaMood,
} from "./persona.js";
import type { Grudge } from "./memory.js";

export interface VerdictInput {
  task: string;
  state: string; // the issue/task body Jev evaluates
  clean: boolean;
  findings: string[];
  grudges: Grudge[];
  mood: PersonaMood;
}

export interface VerdictResult {
  text: string;
  source: "jev" | "heuristic";
  decision?: {
    hasUnresolvedTodo: number | null;
    hasSecurityRisk: number | null;
    readiness: number | null;
    category: string | null;
    confidence: number | null;
  };
}

// Deterministic heuristic used when Jev is unavailable.
function heuristic(state: string): { clean: boolean; category: string; findings: string[] } {
  const findings: string[] = [];
  let clean = true;
  if (/TODO|FIXME|console\.log/i.test(state)) {
    findings.push("contains TODO/FIXME/console.log markers");
    clean = false;
  }
  if (/password|secret|api[_-]?key|eval\(/i.test(state)) {
    findings.push("possible security risk (secret/eval)");
    clean = false;
  }
  if (state.trim().length < 20) {
    findings.push("suspiciously short (vague acceptance criteria)");
    clean = false;
  }
  const category = !clean
    ? /secret|eval|password/i.test(state)
      ? "insecure"
      : /TODO|FIXME/i.test(state)
        ? "incomplete"
        : "vague"
    : "ready";
  return { clean, category, findings };
}

function buildText(inp: VerdictInput, clean: boolean, category: string | null, confidence: number | null): string {
  const seed = inp.task.length;
  const lines: string[] = [];
  lines.push(verdictLine(clean && inp.findings.length === 0, seed));
  const catLine = category ? categoryVerdict(category, seed) : null;
  if (catLine && !clean) lines.push(catLine);
  if (confidence !== null && confidence < 0.5) lines.push(lowConfidenceLine(seed));
  if (inp.grudges.length > 0) {
    lines.push(grudgeOpener(seed));
    for (const g of inp.grudges.slice(0, 2)) lines.push(grudgeCitation(g.when, g.what, seed));
  }
  if (inp.findings.length > 0) {
    lines.push("Findings:");
    for (const f of inp.findings) lines.push(`  - ${f}`);
  }
  return lines.join("\n");
}

export async function produceVerdict(cfg: GatewayConfig, inp: VerdictInput): Promise<VerdictResult> {
  // Try Jev first (typed decision core).
  if (cfg.openrouterConn) {
    const jev = await jevDecide(cfg, inp.state);
    if (jev.ok) {
      const a = jev.answers;
      const todo = a.has_unresolved_todo?.noul ?? null;
      const risk = a.has_security_risk?.noul ?? null;
      const readiness = a.readiness?.score ?? null;
      const category = a.category?.choice ?? null;
      const confidence = a.category?.confidence ?? a.readiness?.confidence ?? null;
      const clean = (todo ?? 0) < 0.5 && (risk ?? 0) < 0.5 && (readiness ?? 100) >= 60;
      const findings: string[] = [];
      if ((todo ?? 0) >= 0.5) findings.push(`Jev: unresolved TODO/FIXME (noul=${todo?.toFixed(2)})`);
      if ((risk ?? 0) >= 0.5) findings.push(`Jev: security risk (noul=${risk?.toFixed(2)})`);
      if (readiness !== null) findings.push(`Jev: readiness ${readiness}/100`);
      if (category) findings.push(`Jev: category=${category}`);
      const text = buildText({ ...inp, findings }, clean, category, confidence);
      return {
        text,
        source: "jev",
        decision: { hasUnresolvedTodo: todo, hasSecurityRisk: risk, readiness, category, confidence },
      };
    }
    // Jev failed — surface the error instead of silently degrading, so a broken
    // connector is visible in the verdict (not mistaken for a clean heuristic run).
    console.error(`> [jev] decision core unavailable (${jev.error ?? "unknown error"}) — falling back to heuristic`);
  } else {
    console.error("> [jev] no OpenRouter connector configured — falling back to heuristic");
  }

  // Fallback: deterministic heuristic + template voice.
  const h = heuristic(inp.state);
  const findings = inp.findings.length > 0 ? inp.findings : h.findings;
  const text = buildText({ ...inp, findings }, h.clean, h.category, null);
  return {
    text,
    source: "heuristic",
    decision: {
      hasUnresolvedTodo: null,
      hasSecurityRisk: null,
      readiness: null,
      category: h.category,
      confidence: null,
    },
  };
}