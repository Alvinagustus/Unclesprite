// smoke.ts — deterministic smoke + negative tests (node --test).
// Proves the pure logic works and FAILS on broken input (red-to-green).

import { test } from "node:test";
import assert from "node:assert";
import { scanEnvForSecrets } from "../src/bunker.js";
import { embed } from "../src/embed.js";
import { paranoidOpener, verdictLine, categoryVerdict, grudgeCitation } from "../src/persona.js";

test("zero-trust: clean env passes", () => {
  const r = scanEnvForSecrets({ HOME: "/home/sprite", PATH: "/usr/bin" });
  assert.equal(r.clean, true);
  assert.equal(r.offenders.length, 0);
});

test("zero-trust NEGATIVE: secret env is caught (red)", () => {
  const r = scanEnvForSecrets({ GITHUB_TOKEN: "ghp_abcdefghijklmnop", SAFE: "x" });
  assert.equal(r.clean, false);
  assert.ok(r.offenders.some((o) => o.includes("GITHUB_TOKEN")));
});

test("embed: deterministic + normalized", () => {
  const a = embed("push secret to main");
  const b = embed("push secret to main");
  assert.deepEqual(a, b);
  const norm = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  assert.ok(Math.abs(norm - 1) < 1e-9);
});

test("embed: different text -> different vector", () => {
  const a = embed("login rate limiting");
  const b = embed("database migration");
  assert.notDeepEqual(a, b);
});

test("persona: deterministic with seed", () => {
  assert.equal(paranoidOpener(5), paranoidOpener(5));
  assert.ok(paranoidOpener(0).length > 0);
});

test("persona: clean vs dirty verdict differ", () => {
  assert.notEqual(verdictLine(true, 0), verdictLine(false, 0));
});

test("persona: category verdict for known + unknown", () => {
  assert.ok(categoryVerdict("insecure", 0));
  assert.equal(categoryVerdict("nonexistent", 0), null);
});

test("persona: grudge citation includes when + what", () => {
  const c = grudgeCitation("Tuesday", "broke main", 0);
  assert.ok(c.includes("Tuesday"));
  assert.ok(c.includes("broke main"));
});