import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { authorizeBsvPayment, initiateBsvPayment, webhookAction } from "../src/flow.js";

test("initiate creates an invoice and authorize stays pending until paid", async () => {
  const invoices = new Map<string, { status: string }>();
  const server = createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/v1/invoices") {
      const id = "inv_medusa";
      invoices.set(id, { status: "pending" });
      res.writeHead(201, { "content-type": "application/json" });
      res.end(JSON.stringify({ invoiceId: id, status: "pending", satoshis: 1000 }));
      return;
    }
    const poll = req.url?.match(/^\/v1\/invoices\/([^/]+)\/poll$/);
    if (req.method === "POST" && poll) {
      const invoice = invoices.get(poll[1]!) ?? { status: "pending" };
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ invoiceId: poll[1], ...invoice }));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  const serverUrl = `http://127.0.0.1:${address.port}`;
  try {
    const initiated = await initiateBsvPayment(
      { serverUrl },
      { amount: 24, currency_code: "usd", data: { session_id: "payses_1", orderRef: "cart_1" } },
    );
    assert.equal(initiated.id, "inv_medusa");
    assert.equal(initiated.status, "pending");
    const waiting = await authorizeBsvPayment({ serverUrl }, { invoiceId: "inv_medusa" });
    assert.equal(waiting.status, "pending_authorization");
    invoices.set("inv_medusa", { status: "paid" });
    const done = await authorizeBsvPayment({ serverUrl }, { invoiceId: "inv_medusa" });
    assert.equal(done.status, "authorized");
    const action = webhookAction({
      data: { type: "invoice.paid", metadata: { session_id: "payses_1" }, satoshis: 1000, invoiceId: "inv_medusa" },
    });
    assert.equal(action.action, "authorized");
    if (action.action === "authorized") assert.equal(action.data.session_id, "payses_1");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
