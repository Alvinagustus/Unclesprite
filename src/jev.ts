// jev.ts — Jev (TypeSafe System One) decision core, called through the
// OpenRouter connector. Jev is a decision model, NOT a chat model: it takes a
// `state` and typed `questions` and returns calibrated answers (noul / score /
// choice) with probabilities. Endpoint: POST /v1/systemone (the only Jev path the
// Sprites gateway forwards, alongside GET /v1/models).

import { gatewayCall, type GatewayConfig } from "./gateway.js";

export type JevPrimitive = "noul" | "score" | "choice";

export interface JevQuestion {
  type: JevPrimitive;
  instructions: string;
  criteria?: string[] | Record<string, string>;
  options?: string[]; // for choice
}

export interface JevAnswer {
  type: JevPrimitive;
  noul?: number;
  score?: number;
  choice?: string;
  probabilities?: Record<string, number>;
  confidence?: number;
}

export interface JevResult {
  ok: boolean;
  answers: Record<string, JevAnswer>;
  model?: string;
  error?: string;
}

// The set of typed questions UncleSprite asks Jev about a task/issue body.
export function buildQuestions(): Record<string, JevQuestion> {
  return {
    has_unresolved_todo: {
      type: "noul",
      instructions: "Does the state contain an unresolved TODO, FIXME, or placeholder that blocks completion?",
      criteria: { true: "an unresolved TODO/FIXME/placeholder is present", false: "no blocking TODO/FIXME/placeholder" },
    },
    has_security_risk: {
      type: "noul",
      instructions: "Does the state describe or introduce a security risk (secrets, injection, missing auth, unsafe eval)?",
      criteria: { true: "a security risk is present or introduced", false: "no security risk detected" },
    },
    readiness: {
      type: "score",
      instructions: "How ready is this issue/task to be implemented safely?",
      criteria: [
        "0-20: vague and incomplete",
        "20-50: some detail but missing pieces",
        "50-80: mostly complete, minor gaps",
        "80-100: fully ready to implement",
      ],
    },
    category: {
      type: "choice",
      instructions: "Classify the primary problem with this task.",
      criteria: {
        vague: "acceptance criteria unclear",
        insecure: "security risk present",
        incomplete: "missing work like TODOs",
        ready: "ready to implement",
      },
      options: ["vague", "insecure", "incomplete", "ready"],
    },
  };
}

// Call Jev via the OpenRouter connector. Returns ok=false on any failure so the
// caller can fall back to the deterministic heuristic.
export async function jevDecide(
  cfg: GatewayConfig,
  state: string,
  questions: Record<string, JevQuestion> = buildQuestions(),
): Promise<JevResult> {
  const model = process.env.JEV_MODEL ?? "typesafe/jev-1.14";
  const res = await gatewayCall(cfg, "openrouter", cfg.openrouterConn ?? "", "/v1/systemone", {
    method: "POST",
    body: JSON.stringify({ model, state, questions }),
  });
  if (!res.ok) return { ok: false, answers: {}, error: `${res.status} ${res.error ?? res.body.slice(0, 120)}` };
  try {
    const parsed = JSON.parse(res.body);
    return { ok: true, answers: parsed.answers ?? {}, model: parsed.model };
  } catch (e) {
    return { ok: false, answers: {}, error: (e as Error).message };
  }
}