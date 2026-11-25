// connectors.ts — typed wrappers over the GitHub / Pinecone / OpenRouter connectors.
// All calls go through the gateway; no provider token ever touches the Sprite.

import { gatewayCall, type GatewayConfig, type GatewayResult } from "./gateway.js";
import { embed, embedDim } from "./embed.js";

export interface GitHubIssue {
  number: number;
  title: string;
  body: string;
}

// Read an issue (title + body) from a repo via the GitHub connector.
export async function fetchIssue(
  cfg: GatewayConfig,
  owner: string,
  repo: string,
  number: number,
): Promise<GatewayResult> {
  return gatewayCall(cfg, "github", cfg.githubConn, `/repos/${owner}/${repo}/issues/${number}`);
}

// Post a comment on an issue/PR via the GitHub connector.
export async function postComment(
  cfg: GatewayConfig,
  owner: string,
  repo: string,
  number: number,
  body: string,
): Promise<GatewayResult> {
  return gatewayCall(cfg, "github", cfg.githubConn, `/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

// Upsert a "grudge" (a past mistake) into Pinecone via the connector.
// Path: /indexes/<index>/vectors/upsert. Falls back to ok=false when unconfigured.
export async function rememberGrudge(
  cfg: GatewayConfig,
  id: string,
  text: string,
  meta: Record<string, unknown> = {},
): Promise<GatewayResult> {
  const index = process.env.PINECONE_INDEX ?? "grudges";
  return gatewayCall(cfg, "pinecone", cfg.pineconeConn ?? "", `/indexes/${index}/vectors/upsert`, {
    method: "POST",
    body: JSON.stringify({
      vectors: [{ id, values: embed(text), metadata: { text, ...meta } }],
    }),
  });
}

// Query Pinecone for grudges similar to the current task. Returns raw body.
export async function recallGrudges(
  cfg: GatewayConfig,
  query: string,
  topK = 3,
): Promise<GatewayResult> {
  const index = process.env.PINECONE_INDEX ?? "grudges";
  return gatewayCall(cfg, "pinecone", cfg.pineconeConn ?? "", `/indexes/${index}/query`, {
    method: "POST",
    body: JSON.stringify({
      vector: embed(query),
      topK,
      includeMetadata: true,
    }),
  });
}

export { embedDim };