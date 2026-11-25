// embed.ts — deterministic local text embedding (hashing bag-of-words).
// No network, no model: same text always yields the same vector. This keeps the
// grudge memory fully deterministic while still using Pinecone as the store.

const DEFAULT_DIM = Number(process.env.EMBED_DIM ?? 384);

// Tokenize into lowercase word tokens.
function tokenize(text: string): string[] {
  return text.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
}

// Deterministic hashing embedding: bag of words -> fixed-dim vector, L2-normalized.
// Uses a simple FNV-1a hash so it is stable across runs and platforms.
export function embed(text: string, dim: number = DEFAULT_DIM): number[] {
  const vec = new Array<number>(dim).fill(0);
  for (const tok of tokenize(text)) {
    let h = 0x811c9dc5;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    const idx = h % dim;
    const sign = (h & 1) === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  // L2 normalize.
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map((v) => v / norm);
}

export function embedDim(): number {
  return DEFAULT_DIM;
}