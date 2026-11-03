import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SHOPIFY_TOKEN_REFRESH_SKEW_MS,
  ShopifyCredentialsError,
  createShopifySession,
  resetShopifySessionForTests,
  shopifySessionFromEnv,
} from "../src/token.js";

const SHOP = "hats.myshopify.com";

function tokenResponse(accessToken: string, expiresIn: number | string = 86399, status = 200): Response {
  return new Response(JSON.stringify({ access_token: accessToken, scope: "write_orders", expires_in: expiresIn }), { status });
}

test("uses SHOPIFY_ADMIN_TOKEN without calling Shopify", async () => {
  let calls = 0;
  const session = createShopifySession({
    shop: `https://${SHOP}/`,
    adminToken: "shpat_static",
    apiKey: "key",
    apiSecret: "secret",
    fetchImpl: async () => {
      calls += 1;
      return new Response("no", { status: 500 });
    },
  });
  assert.equal(session.refreshable, false);
  assert.equal(session.shop, SHOP);
  assert.equal(await session.getAccessToken(), "shpat_static");
  assert.equal(await session.getAccessToken({ forceRefresh: true }), "shpat_static");
  const response = await session.authorizedFetch(`https://${SHOP}/admin/api/2025-10/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(response.status, 500);
  assert.equal(calls, 1);
});

test("exchanges client credentials and caches the token in memory", async () => {
  const seen: Array<{ url: string; contentType: string; params: URLSearchParams }> = [];
  let tokenCalls = 0;
  const session = shopifySessionFromEnv(
    {
      SHOPIFY_SHOP: `https://${SHOP}/`,
      SHOPIFY_API_KEY: "client-id",
      SHOPIFY_API_SECRET: "secret&x=1",
      SHOPIFY_API_VERSION: "2026-01",
    },
    {
      now: () => 1_000_000,
      fetchImpl: async (url, init) => {
        const headers = init?.headers as Record<string, string>;
        const params = new URLSearchParams(String(init?.body ?? ""));
        seen.push({ url: String(url), contentType: headers["content-type"], params });
        tokenCalls += 1;
        return tokenResponse("minted", "86399");
      },
    },
  );
  assert.equal(session.refreshable, true);
  assert.equal(session.apiVersion, "2026-01");
  assert.equal(await session.getAccessToken(), "minted");
  assert.equal(await session.getAccessToken(), "minted");
  assert.equal(tokenCalls, 1);
  assert.equal(seen[0]?.url, `https://${SHOP}/admin/oauth/access_token`);
  assert.equal(seen[0]?.contentType, "application/x-www-form-urlencoded");
  assert.equal(seen[0]?.params.get("grant_type"), "client_credentials");
  assert.equal(seen[0]?.params.get("client_id"), "client-id");
  assert.equal(seen[0]?.params.get("client_secret"), "secret&x=1");
  assert.equal(seen[0]?.params.get("scope"), null);
});

test("refreshes one minute before expiry", async () => {
  assert.equal(SHOPIFY_TOKEN_REFRESH_SKEW_MS, 60_000);
  let now = 1_000_000;
  let tokenCalls = 0;
  const session = createShopifySession({
    shop: SHOP,
    apiKey: "key",
    apiSecret: "secret",
    now: () => now,
    fetchImpl: async () => {
      tokenCalls += 1;
      return tokenResponse(`tok-${tokenCalls}`, 86399);
    },
  });
  assert.equal(await session.getAccessToken(), "tok-1");
  const lifetimeMs = 86399 * 1000;
  now = 1_000_000 + lifetimeMs - SHOPIFY_TOKEN_REFRESH_SKEW_MS - 1;
  assert.equal(await session.getAccessToken(), "tok-1");
  assert.equal(tokenCalls, 1);
  now = 1_000_000 + lifetimeMs - SHOPIFY_TOKEN_REFRESH_SKEW_MS;
  assert.equal(await session.getAccessToken(), "tok-2");
  assert.equal(tokenCalls, 2);
});

test("refreshes a short-lived token halfway through its lifetime", async () => {
  let now = 0;
  let tokenCalls = 0;
  const session = createShopifySession({
    shop: SHOP,
    apiKey: "key",
    apiSecret: "secret",
    now: () => now,
    fetchImpl: async () => {
      tokenCalls += 1;
      return tokenResponse(`tok-${tokenCalls}`, 30);
    },
  });
  assert.equal(await session.getAccessToken(), "tok-1");
  now = 14_999;
  assert.equal(await session.getAccessToken(), "tok-1");
  now = 15_000;
  assert.equal(await session.getAccessToken(), "tok-2");
  assert.equal(tokenCalls, 2);
});

test("shares one in-flight client-credentials request", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  const session = createShopifySession({
    shop: SHOP,
    apiKey: "key",
    apiSecret: "secret",
    fetchImpl: async () => {
      calls += 1;
      await gate;
      return tokenResponse("shared", 500);
    },
  });
  const pending = Promise.all([session.getAccessToken(), session.getAccessToken()]);
  release();
  assert.deepEqual(await pending, ["shared", "shared"]);
  assert.equal(calls, 1);
});

test("refreshes once and retries the Admin call after a 401", async () => {
  const adminTokens: string[] = [];
  let tokenCalls = 0;
  const session = createShopifySession({
    shop: SHOP,
    apiKey: "key",
    apiSecret: "secret",
    now: () => 0,
    fetchImpl: async (url, init) => {
      if (String(url).endsWith("/admin/oauth/access_token")) {
        tokenCalls += 1;
        return tokenResponse(tokenCalls === 1 ? "first" : "second", 86399);
      }
      const token = String((init?.headers as Record<string, string>)["x-shopify-access-token"]);
      adminTokens.push(token);
      if (token === "first") return new Response("unauthorized", { status: 401 });
      return new Response("ok", { status: 200 });
    },
  });
  const response = await session.authorizedFetch(`https://${SHOP}/admin/api/2025-10/graphql.json`, {
    method: "POST",
    body: "{}",
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "ok");
  assert.deepEqual(adminTokens, ["first", "second"]);
  assert.equal(tokenCalls, 2);

  adminTokens.length = 0;
  const again = await session.authorizedFetch(`https://${SHOP}/admin/api/2025-10/graphql.json`);
  assert.equal(again.status, 200);
  assert.deepEqual(adminTokens, ["second"]);
  assert.equal(tokenCalls, 2);
});

test("does not refresh more than once when the new token also answers 401", async () => {
  let tokenCalls = 0;
  let adminCalls = 0;
  const session = createShopifySession({
    shop: SHOP,
    apiKey: "key",
    apiSecret: "secret",
    fetchImpl: async (url) => {
      if (String(url).endsWith("/admin/oauth/access_token")) {
        tokenCalls += 1;
        return tokenResponse(`t${tokenCalls}`, 1000);
      }
      adminCalls += 1;
      return new Response("no", { status: 401 });
    },
  });
  const response = await session.authorizedFetch(`https://${SHOP}/admin/api/2025-10/graphql.json`);
  assert.equal(response.status, 401);
  assert.equal(adminCalls, 2);
  assert.equal(tokenCalls, 2);
});

test("a static token is not refreshed after a 401", async () => {
  let calls = 0;
  const session = createShopifySession({
    shop: SHOP,
    adminToken: "shpat_static",
    fetchImpl: async (_url, init) => {
      calls += 1;
      assert.equal((init?.headers as Record<string, string>)["x-shopify-access-token"], "shpat_static");
      return new Response("no", { status: 401 });
    },
  });
  const response = await session.authorizedFetch(`https://${SHOP}/admin/api/2025-10/graphql.json`);
  assert.equal(response.status, 401);
  assert.equal(calls, 1);
});

test("a failed token request is not cached", async () => {
  let calls = 0;
  const session = createShopifySession({
    shop: SHOP,
    apiKey: "key",
    apiSecret: "super-secret",
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return new Response("invalid_client", { status: 401 });
      return tokenResponse("recovered", 120);
    },
  });
  await assert.rejects(session.getAccessToken(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /Shopify token request failed: HTTP 401/);
    assert.equal(error.message.includes("super-secret"), false);
    return true;
  });
  assert.equal(await session.getAccessToken(), "recovered");
  assert.equal(calls, 2);
});

test("a failed forced refresh clears the cached token", async () => {
  let calls = 0;
  const session = createShopifySession({
    shop: SHOP,
    apiKey: "key",
    apiSecret: "secret",
    now: () => 0,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 2) return new Response("unavailable", { status: 503 });
      return tokenResponse(calls === 1 ? "good" : "better", 500);
    },
  });
  assert.equal(await session.getAccessToken(), "good");
  await assert.rejects(session.getAccessToken({ forceRefresh: true }), /HTTP 503/);
  assert.equal(await session.getAccessToken(), "better");
  assert.equal(calls, 3);
});

test("rejects a token response without access_token or expires_in", async () => {
  const missingToken = createShopifySession({
    shop: SHOP,
    apiKey: "key",
    apiSecret: "secret",
    fetchImpl: async () => new Response(JSON.stringify({ expires_in: 10 }), { status: 200 }),
  });
  await assert.rejects(missingToken.getAccessToken(), /access_token missing/);

  const missingExpiry = createShopifySession({
    shop: SHOP,
    apiKey: "key",
    apiSecret: "secret",
    fetchImpl: async () => new Response(JSON.stringify({ access_token: "x" }), { status: 200 }),
  });
  await assert.rejects(missingExpiry.getAccessToken(), /expires_in missing/);

  const notJson = createShopifySession({
    shop: SHOP,
    apiKey: "key",
    apiSecret: "secret",
    fetchImpl: async () => new Response("ok", { status: 200 }),
  });
  await assert.rejects(notJson.getAccessToken(), /not JSON/);
});

test("requires the shop and either a static token or a client id and secret", () => {
  assert.throws(() => createShopifySession({ shop: "https://" }), ShopifyCredentialsError);
  assert.throws(() => createShopifySession({ shop: SHOP }), /SHOPIFY_API_KEY/);
  assert.throws(() => createShopifySession({ shop: SHOP, apiKey: "key" }), /SHOPIFY_API_SECRET/);
  assert.throws(() => createShopifySession({ shop: SHOP, apiSecret: "secret" }), /SHOPIFY_API_KEY/);
  assert.throws(
    () => shopifySessionFromEnv({ SHOPIFY_SHOP: SHOP, SHOPIFY_API_KEY: "key", SHOPIFY_ADMIN_TOKEN: "  " }),
    ShopifyCredentialsError,
  );
});

test("shopifySessionFromEnv reuses one session for the process", () => {
  const keys = ["SHOPIFY_SHOP", "SHOPIFY_API_KEY", "SHOPIFY_API_SECRET", "SHOPIFY_ADMIN_TOKEN"] as const;
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  process.env.SHOPIFY_SHOP = SHOP;
  process.env.SHOPIFY_API_KEY = "key";
  process.env.SHOPIFY_API_SECRET = "secret";
  delete process.env.SHOPIFY_ADMIN_TOKEN;
  resetShopifySessionForTests();
  try {
    const first = shopifySessionFromEnv();
    const second = shopifySessionFromEnv();
    assert.equal(first, second);
    assert.equal(first.refreshable, true);
  } finally {
    resetShopifySessionForTests();
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
