import assert from "node:assert/strict";
import { test } from "node:test";
import { markBigCommerceOrderPaid } from "../src/index.js";

test("updates an order to the paid status id", async () => {
  let seen: { url: string; body: { status_id: number }; token: string } | undefined;
  const order = await markBigCommerceOrderPaid(
    {
      storeHash: "abc123",
      accessToken: "token",
      paidStatusId: 11,
      fetchImpl: async (url, init) => {
        seen = {
          url: String(url),
          body: JSON.parse(String(init?.body)),
          token: String((init?.headers as Record<string, string>)["x-auth-token"]),
        };
        return new Response(JSON.stringify({ id: 55, status_id: 11 }), { status: 200 });
      },
    },
    55,
  );
  assert.equal(seen?.url, "https://api.bigcommerce.com/stores/abc123/v2/orders/55");
  assert.equal(seen?.body.status_id, 11);
  assert.equal(seen?.token, "token");
  assert.equal(order.status_id, 11);
});
