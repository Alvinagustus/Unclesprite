// bunker.ts — Paranoid Bunker Mode.
// 1. Prove the environment holds no provider secrets (zero-trust rant).
// 2. Optionally snapshot the Sprite filesystem via checkpoint before any work.

import { execFileSync } from "node:child_process";
import fs from "node:fs";

export interface ZeroTrustReport {
  clean: boolean;
  scanned: number;
  offenders: string[];
}

// Patterns that would indicate a leaked provider credential inside the Sprite.
const SECRET_PATTERNS = [
  /API_KEY/i,
  /SECRET/i,
  /ACCESS_TOKEN/i,
  /PRIVATE_KEY/i,
  /BEARER\s+[A-Za-z0-9]/i,
  /sk-[A-Za-z0-9]{10,}/,
  /ghp_[A-Za-z0-9]{10,}/,
];

// Scan the current process environment AND common secret-file locations for
// anything that looks like a provider credential. The Sprite is supposed to hold
// ZERO provider keys — all access is via the gateway.
export function scanEnvForSecrets(env: NodeJS.ProcessEnv = process.env): ZeroTrustReport {
  const offenders: string[] = [];
  let scanned = 0;
  for (const [k, v] of Object.entries(env)) {
    scanned++;
    if (SECRET_PATTERNS.some((re) => re.test(k) || re.test(v ?? ""))) {
      offenders.push(`env:${k}`);
    }
  }
  // Also check for on-disk secret files in the working dir and home.
  const candidates = [
    ".env",
    ".env.local",
    ".env.production",
    ".env.secrets",
    `${process.env.HOME ?? "/home/sprite"}/.env`,
    `${process.env.HOME ?? "/home/sprite"}/.config/unclesprite/.env`,
  ];
  for (const p of candidates) {
    try {
      fs.accessSync(p);
      scanned++;
      offenders.push(`file:${p}`);
    } catch {
      /* not present — good */
    }
  }
  return { clean: offenders.length === 0, scanned, offenders };
}

export interface CheckpointResult {
  attempted: boolean;
  ok: boolean;
  id?: string;
  output: string;
}

// Create a Sprite checkpoint via the sprite CLI. Best-effort: if the CLI or a
// sprite is unavailable (e.g. running on a laptop), we report attempted=false
// and the caller continues — the demo still runs.
export function createCheckpoint(spriteName: string | undefined): CheckpointResult {
  if (!spriteName) {
    return { attempted: false, ok: false, output: "no sprite context; skipping checkpoint" };
  }
  try {
    const out = execFileSync("sprite", ["checkpoint", "create", "-s", spriteName], {
      encoding: "utf8",
      timeout: 60000,
    });
    return { attempted: true, ok: true, output: out.trim() };
  } catch (e) {
    return { attempted: true, ok: false, output: (e as Error).message };
  }
}