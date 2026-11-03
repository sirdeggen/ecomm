import assert from "node:assert/strict";
import { test } from "node:test";
import { markShopifyOrderPaid, orderGid } from "../src/index.js";

test("marks a manual order paid with orderMarkAsPaid", async () => {
  let seen: { url: string; body: { query: string; variables: { input: { id: string } } }; token: string } | undefined;
  const order = await markShopifyOrderPaid(
    {
      shop: "bsv-hats.myshopify.com",
      accessToken: "shpat_test",
      apiVersion: "2025-10",
      refreshAccessToken: async () => {
        throw new Error("fresh token was not required");
      },
      fetchImpl: async (url, init) => {
        seen = {
          url: String(url),
          body: JSON.parse(String(init?.body)),
          token: String((init?.headers as Record<string, string>)["x-shopify-access-token"]),
        };
        return new Response(
          JSON.stringify({
            data: { orderMarkAsPaid: { userErrors: [], order: { id: orderGid(99), displayFinancialStatus: "PAID" } } },
          }),
          { status: 200 },
        );
      },
    },
    orderGid(99),
  );
  assert.equal(seen?.url, "https://bsv-hats.myshopify.com/admin/api/2025-10/graphql.json");
  assert.match(seen?.body.query ?? "", /orderMarkAsPaid/);
  assert.equal(seen?.body.variables.input.id, "gid://shopify/Order/99");
  assert.equal(seen?.token, "shpat_test");
  assert.equal(order?.displayFinancialStatus, "PAID");
});

test("prefixes a numeric order id", () => {
  assert.equal(orderGid(12), "gid://shopify/Order/12");
  assert.equal(orderGid("gid://shopify/Order/12"), "gid://shopify/Order/12");
});

test("retries orderMarkAsPaid once after Shopify answers 401", async () => {
  const tokens: string[] = [];
  let refreshes = 0;
  const order = await markShopifyOrderPaid(
    {
      shop: "https://bsv-hats.myshopify.com/",
      accessToken: "expired",
      apiVersion: "2025-10",
      refreshAccessToken: async () => {
        refreshes += 1;
        return "fresh";
      },
      fetchImpl: async (_url, init) => {
        const token = String((init?.headers as Record<string, string>)["x-shopify-access-token"]);
        tokens.push(token);
        if (token === "expired") return new Response("expired", { status: 401 });
        return new Response(
          JSON.stringify({
            data: { orderMarkAsPaid: { userErrors: [], order: { id: orderGid(99), displayFinancialStatus: "PAID" } } },
          }),
          { status: 200 },
        );
      },
    },
    orderGid(99),
  );
  assert.deepEqual(tokens, ["expired", "fresh"]);
  assert.equal(refreshes, 1);
  assert.equal(order?.displayFinancialStatus, "PAID");
});

test("stops after one refresh when Shopify answers 401 again", async () => {
  let calls = 0;
  let refreshes = 0;
  await assert.rejects(
    () =>
      markShopifyOrderPaid(
        {
          shop: "bsv-hats.myshopify.com",
          accessToken: "expired",
          apiVersion: "2025-10",
          refreshAccessToken: async () => {
            refreshes += 1;
            return "still-bad";
          },
          fetchImpl: async () => {
            calls += 1;
            return new Response("unauthorized", { status: 401 });
          },
        },
        orderGid(1),
      ),
    /Shopify HTTP 401/,
  );
  assert.equal(calls, 2);
  assert.equal(refreshes, 1);
});
