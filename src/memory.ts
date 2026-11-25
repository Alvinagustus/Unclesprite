// memory.ts — Grudge Memory (Pinecone-backed, with deterministic local fallback).
// Stores past mistakes and recalls similar ones for the current task.

import { recallGrudges, rememberGrudge } from "./connectors.js";
import type { GatewayConfig } from "./gateway.js";
import fs from "node:fs";

export interface Grudge {
  id: string;
  when: string;
  what: string;
}

// In-memory + file fallback store, used when Pinecone is unavailable.
// Persists to a JSON file so grudges survive across runs on the same Sprite.
const STORE_PATH = process.env.GRUDGE_STORE ?? "/home/sprite/.unclesprite/grudges.json";

function loadLocal(): Grudge[] {
  try {
    return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")) as Grudge[];
  } catch {
    return [];
  }
}

function saveLocal(g: Grudge[]): void {
  try {
    fs.mkdirSync(STORE_PATH.replace(/\/[^/]+$/, ""), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(g, null, 2));
  } catch {
    /* best effort */
  }
}

export async function addGrudge(cfg: GatewayConfig, g: Grudge): Promise<"pinecone" | "local"> {
  const res = await rememberGrudge(cfg, g.id, g.what, { when: g.when });
  if (res.ok) return "pinecone";
  const all = loadLocal();
  all.push(g);
  saveLocal(all);
  return "local";
}

export async function recall(cfg: GatewayConfig, task: string): Promise<Grudge[]> {
  const res = await recallGrudges(cfg, task, 3);
  if (res.ok) {
    try {
      const parsed = JSON.parse(res.body);
      const matches = parsed.matches ?? [];
      return matches.map((m: any) => ({
        id: m.id,
        when: m.metadata?.when ?? "some time ago",
        what: m.metadata?.text ?? String(m.id),
      }));
    } catch {
      /* fall through to local */
    }
  }
  // Local fallback: naive keyword overlap.
  const words = task.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  return loadLocal()
    .map((g) => ({ g, score: words.filter((w) => g.what.toLowerCase().includes(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.g);
}