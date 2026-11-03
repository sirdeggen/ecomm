/**
 * Admin API tokens for a Dev Dashboard app.
 * https://shopify.dev/docs/apps/build/authentication-authorization/client-credentials-grant
 *
 * The client-credentials grant returns an access token that expires in about 24 hours
 * (`expires_in` is 86399). There is no refresh token. This module caches the token in
 * memory and requests a new one shortly before expiry. A static `SHOPIFY_ADMIN_TOKEN`
 * skips the grant.
 */

/** Request a new token this long before `expires_in`. Shopify's example uses one minute. */
export const SHOPIFY_TOKEN_REFRESH_SKEW_MS = 60_000;

export class ShopifyCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopifyCredentialsError";
  }
}

export interface ShopifySessionOptions {
  shop: string;
  /** Static Admin API token. When set, client credentials are not exchanged. */
  adminToken?: string;
  /** Dev Dashboard client id (`SHOPIFY_API_KEY`). */
  apiKey?: string;
  /** Dev Dashboard client secret (`SHOPIFY_API_SECRET`). */
  apiSecret?: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Milliseconds before expiry to refresh. Defaults to one minute. */
  refreshSkewMs?: number;
}

export interface ShopifySession {
  shop: string;
  apiVersion?: string;
  /** False when a static `SHOPIFY_ADMIN_TOKEN` is in use. */
  readonly refreshable: boolean;
  getAccessToken(options?: { forceRefresh?: boolean }): Promise<string>;
  /** Admin API fetch. Attaches the access token and retries once after a 401 when the token is refreshable. */
  authorizedFetch(url: string, init?: RequestInit): Promise<Response>;
}

interface CachedToken {
  accessToken: string;
  /** Epoch milliseconds when the cached token should be replaced. */
  refreshAt: number;
}

let processSession: ShopifySession | undefined;

export function normalizeShop(shop: string): string {
  return shop.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export function createShopifySession(options: ShopifySessionOptions): ShopifySession {
  const shop = normalizeShop(options.shop || "");
  if (!shop) throw new ShopifyCredentialsError("SHOPIFY_SHOP is required");
  const adminToken = options.adminToken?.trim() || "";
  const apiKey = options.apiKey?.trim() || "";
  const apiSecret = options.apiSecret?.trim() || "";
  if (!adminToken && (!apiKey || !apiSecret)) {
    throw new ShopifyCredentialsError("Set SHOPIFY_ADMIN_TOKEN or both SHOPIFY_API_KEY and SHOPIFY_API_SECRET");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? (() => Date.now());
  const refreshSkewMs = Math.max(0, options.refreshSkewMs ?? SHOPIFY_TOKEN_REFRESH_SKEW_MS);
  const refreshable = !adminToken;
  const apiVersion = options.apiVersion?.trim() || undefined;

  let cached: CachedToken | undefined;
  let tail: Promise<void> = Promise.resolve();

  async function loadToken(forceRefresh: boolean): Promise<string> {
    if (adminToken) return adminToken;
    if (!forceRefresh && cached && now() < cached.refreshAt) return cached.accessToken;
    if (forceRefresh) cached = undefined;
    const next = await requestClientCredentialsToken({ shop, apiKey, apiSecret, fetchImpl, now, refreshSkewMs });
    cached = next;
    return next.accessToken;
  }

  function getAccessToken(request?: { forceRefresh?: boolean }): Promise<string> {
    const result = tail.then(() => loadToken(Boolean(request?.forceRefresh)));
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  return {
    shop,
    apiVersion,
    refreshable,
    getAccessToken,
    authorizedFetch(url, init) {
      return shopifyAuthorizedFetch(
        fetchImpl,
        url,
        init,
        () => getAccessToken(),
        refreshable ? () => getAccessToken({ forceRefresh: true }) : undefined,
      );
    },
  };
}

export interface ShopifySessionOverrides {
  fetchImpl?: typeof fetch;
  now?: () => number;
  refreshSkewMs?: number;
}

/**
 * Session for the current process. Repeated calls with `process.env` and no overrides
 * return the same object, so the receiver reuses one cached token.
 */
export function shopifySessionFromEnv(env: NodeJS.ProcessEnv = process.env, overrides: ShopifySessionOverrides = {}): ShopifySession {
  const memoize = env === process.env && overrides.fetchImpl === undefined && overrides.now === undefined && overrides.refreshSkewMs === undefined;
  if (memoize && processSession) return processSession;
  const session = createShopifySession({
    shop: env.SHOPIFY_SHOP ?? "",
    adminToken: env.SHOPIFY_ADMIN_TOKEN,
    apiKey: env.SHOPIFY_API_KEY,
    apiSecret: env.SHOPIFY_API_SECRET,
    apiVersion: env.SHOPIFY_API_VERSION,
    fetchImpl: overrides.fetchImpl,
    now: overrides.now,
    refreshSkewMs: overrides.refreshSkewMs,
  });
  if (memoize) processSession = session;
  return session;
}

export function resetShopifySessionForTests(): void {
  processSession = undefined;
}

/**
 * Perform an Admin API request with `x-shopify-access-token`.
 * When `refreshAccessToken` is set and Shopify answers 401, refresh once and retry the same request once.
 */
export async function shopifyAuthorizedFetch(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit | undefined,
  accessToken: string | (() => Promise<string>),
  refreshAccessToken?: () => Promise<string>,
): Promise<Response> {
  const token = typeof accessToken === "function" ? await accessToken() : accessToken;
  const response = await fetchImpl(url, applyAccessToken(init, token));
  if (response.status !== 401 || !refreshAccessToken) return response;
  const next = await refreshAccessToken();
  return fetchImpl(url, applyAccessToken(init, next));
}

async function requestClientCredentialsToken(input: {
  shop: string;
  apiKey: string;
  apiSecret: string;
  fetchImpl: typeof fetch;
  now: () => number;
  refreshSkewMs: number;
}): Promise<CachedToken> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: input.apiKey,
    client_secret: input.apiSecret,
  });
  const response = await input.fetchImpl(`https://${input.shop}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const text = await response.text();
  if (!response.ok) {
    const detail = text ? `: ${text.slice(0, 300)}` : "";
    throw new Error(`Shopify token request failed: HTTP ${response.status}${detail}`);
  }
  let parsed: { access_token?: unknown; expires_in?: unknown };
  try {
    parsed = JSON.parse(text) as { access_token?: unknown; expires_in?: unknown };
  } catch {
    throw new Error("Shopify token request failed: response was not JSON");
  }
  if (typeof parsed.access_token !== "string" || parsed.access_token.length === 0) {
    throw new Error("Shopify token request failed: access_token missing");
  }
  const expiresIn = typeof parsed.expires_in === "number" ? parsed.expires_in : Number(parsed.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error("Shopify token request failed: expires_in missing");
  }
  const lifetimeMs = expiresIn * 1000;
  // A short-lived token refreshes halfway through its life, so the value just fetched is still used.
  const skew = Math.min(input.refreshSkewMs, Math.floor(lifetimeMs / 2));
  return { accessToken: parsed.access_token, refreshAt: input.now() + lifetimeMs - skew };
}

function applyAccessToken(init: RequestInit | undefined, token: string): RequestInit {
  const headers: Record<string, string> = {};
  if (init?.headers) {
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
  }
  headers["x-shopify-access-token"] = token;
  return { ...init, headers };
}
