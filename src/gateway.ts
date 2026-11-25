// gateway.ts — low-level Sprites Connector Gateway caller.
// Every external API call goes through the gateway so the Sprite never holds a
// provider token. No Authorization header: the gateway authenticates the
// calling Sprite from Fly.io's request signature.

export interface GatewayConfig {
  baseUrl: string;
  githubConn: string;
  pineconeConn?: string;
  openrouterConn?: string;
}

export interface GatewayResult {
  ok: boolean;
  status: number;
  body: string;
  error?: string;
}

export function gatewayConfigFromEnv(): GatewayConfig {
  const baseUrl = process.env.GATEWAY_BASE_URL ?? "https://api.sprites.dev/v1/gateway";
  return {
    baseUrl,
    githubConn: process.env.GITHUB_CONN_ID ?? "",
    pineconeConn: process.env.PINECONE_CONN_ID ?? "",
    openrouterConn: process.env.OPENROUTER_CONN_ID ?? "",
  };
}

// Call `https://<base>/<provider>/<conn>/<path>`.
// Returns ok=false (never throws) on network failure so callers can fall back.
export async function gatewayCall(
  cfg: GatewayConfig,
  provider: string,
  connId: string,
  path: string,
  init: { method?: string; body?: string } = {},
): Promise<GatewayResult> {
  if (!connId) {
    return { ok: false, status: 0, body: "", error: "no connector id configured" };
  }
  const url = `${cfg.baseUrl}/${provider}/${connId}/${path.replace(/^\//, "")}`;
  try {
    const res = await fetch(url, {
      method: init.method ?? "GET",
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
      body: init.body,
    });
    const body = await res.text();
    return { ok: res.ok, status: res.status, body };
  } catch (e) {
    return { ok: false, status: 0, body: "", error: (e as Error).message };
  }
}