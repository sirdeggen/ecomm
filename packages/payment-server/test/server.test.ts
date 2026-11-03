import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { HD } from "@bsv/sdk";
import type { ChainReader } from "@ecomm/bsv-core";
import { createChainReader } from "../src/toolboxChain.js";
import { loadConfig } from "../src/config.js";
import { createHttpServer } from "../src/http.js";
import { PaymentService } from "../src/service.js";
import { InvoiceStore } from "../src/store.js";
import { signaturesMatch, signBody } from "../src/webhook.js";

function xpub(): string {
  const seed = Array.from({ length: 64 }, (_, i) => (i * 3 + 1) % 256);
  return HD.fromSeed(seed).toPublic().toString();
}

function chain(): ChainReader {
  return {
    network: "testnet",
    async getUsdPerBsv() {
      return { usdPerBsv: 50, source: "static", quotedAt: new Date().toISOString() };
    },
    async getAddressHistory() {
      return [];
    },
    async getRawTransaction() {
      return undefined;
    },
    async getTransactionStatus(txid) {
      return { txid, found: false, accepted: false, confirmed: false, invalid: false, source: "none" };
    },
  };
}

async function boot(extra: Record<string, string> = {}) {
  const dataDir = mkdtempSync(path.join(tmpdir(), "bsv-pay-"));
  const config = loadConfig({
    BSV_NETWORK: "testnet",
    BSV_XPUB: xpub(),
    BSV_STATIC_USD_RATE: "50",
    BSV_PAYMAIL: "hats@example.test",
    ALLOW_SIMULATED_PAYMENTS: "true",
    DATA_DIR: dataDir,
    WEBHOOK_SECRET: "test-secret",
    PAYMENT_SERVER_PUBLIC_URL: "http://127.0.0.1:9",
    ...extra,
  });
  const service = new PaymentService(config, new InvoiceStore(dataDir), chain());
  const server = createHttpServer(config, service);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  const base = `http://127.0.0.1:${address.port}`;
  return {
    base,
    config,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

test("creates an invoice, quotes satoshis, and keeps a unique output per order", async () => {
  const ctx = await boot();
  try {
    const created = await post(ctx.base, "/v1/invoices", {
      orderRef: "hat-1",
      fiatAmount: "24.00",
      fiatCurrency: "USD",
      platform: "stripe",
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.satoshis, 48_000_000);
    assert.equal(created.body.bsvAmount, "0.48");
    assert.equal(created.body.network, "testnet");
    assert.equal(created.body.paymail, "hats@example.test");
    assert.match(created.body.address, /^[mn2]/);
    assert.ok(String(created.body.bip21).includes(created.body.address));

    const again = await post(ctx.base, "/v1/invoices", {
      orderRef: "hat-1",
      fiatAmount: "24.00",
      platform: "stripe",
    });
    assert.equal(again.body.invoiceId, created.body.invoiceId);

    const second = await post(ctx.base, "/v1/invoices", {
      orderRef: "hat-2",
      fiatAmount: "18.00",
      platform: "stripe",
    });
    assert.notEqual(second.body.address, created.body.address);
    assert.equal(second.body.derivationIndex, created.body.derivationIndex + 1);

    const qr = await fetch(`${ctx.base}/v1/invoices/${created.body.invoiceId}/qr.svg`);
    assert.equal(qr.status, 200);
    assert.match(await qr.text(), /<svg/);
  } finally {
    await ctx.close();
  }
});

test("simulated payment emits a signed paid webhook and is rejected when disabled", async () => {
  const hooks: { body: string; signature: string }[] = [];
  const hookServer = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    hooks.push({
      body: Buffer.concat(chunks).toString("utf8"),
      signature: String(req.headers["x-bsv-signature"] ?? ""),
    });
    res.writeHead(200);
    res.end("ok");
  });
  await new Promise<void>((resolve) => hookServer.listen(0, "127.0.0.1", resolve));
  const hookAddr = hookServer.address();
  if (!hookAddr || typeof hookAddr === "string") throw new Error("no hook port");
  const webhookUrl = `http://127.0.0.1:${hookAddr.port}/hook`;

  const ctx = await boot();
  const disabled = await boot({ ALLOW_SIMULATED_PAYMENTS: "false" });
  try {
    const created = await post(ctx.base, "/v1/invoices", {
      orderRef: "order-sim",
      fiatAmount: "32.00",
      webhookUrl,
      platform: "woocommerce",
    });
    const paid = await post(ctx.base, `/v1/invoices/${created.body.invoiceId}/simulate`, {});
    assert.equal(paid.status, 200);
    assert.equal(paid.body.status, "paid");
    assert.equal(paid.body.simulated, true);
    assert.equal(paid.body.txid.length, 64);
    assert.equal(hooks.length, 1);
    const event = JSON.parse(hooks[0]!.body);
    assert.equal(event.type, "invoice.paid");
    assert.equal(event.txid, paid.body.txid);
    assert.equal(event.orderRef, "order-sim");
    assert.equal(signaturesMatch(signBody(hooks[0]!.body, "test-secret"), hooks[0]!.signature), true);

    const blocked = await post(disabled.base, "/v1/invoices", { orderRef: "x", fiatAmount: "1.00" });
    const denied = await post(disabled.base, `/v1/invoices/${blocked.body.invoiceId}/simulate`, {});
    assert.equal(denied.status, 403);
    assert.equal(denied.body.error, "simulate_disabled");
  } finally {
    await ctx.close();
    await disabled.close();
    await new Promise<void>((resolve, reject) => hookServer.close((error) => (error ? reject(error) : resolve())));
  }
});

test("payment server chain reader uses wallet-toolbox", async () => {
  const { backend, reader } = await createChainReader({ network: "testnet", arcUrl: "https://arc-test.taal.com" });
  assert.equal(backend, "wallet-toolbox");
  assert.equal(reader.network, "testnet");
  const rate = await reader.getUsdPerBsv();
  assert.ok(rate.usdPerBsv > 0);
  assert.match(rate.source, /whatsonchain/);
});

async function post(base: string, pathname: string, body: unknown): Promise<{ status: number; body: Record<string, any> }> {
  const response = await fetch(`${base}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json()) as Record<string, any> };
}
