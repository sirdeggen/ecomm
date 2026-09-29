import assert from "node:assert/strict";
import { test } from "node:test";
import { HD, Script, Transaction } from "@bsv/sdk";
import {
  buildPaidEvent,
  buildPaymentRequest,
  buildQuote,
  centsToSatoshis,
  detectPayment,
  deriveReceiveOutput,
  HttpChainReader,
  parseFiatCents,
  payWithWallet,
  quoteExpired,
  satoshisPaidToScript,
  verifyRawPayment,
  type ChainReader,
  type PaymentRequest,
} from "../src/index.js";

function accountXpub(): string {
  const seed = Array.from({ length: 64 }, (_, i) => (i * 7 + 3) % 256);
  return HD.fromSeed(seed).toPublic().toString();
}

function sampleRequest(overrides: Partial<Parameters<typeof buildPaymentRequest>[0]> = {}): PaymentRequest {
  return buildPaymentRequest({
    invoiceId: "inv_test",
    orderRef: "order-1",
    network: "testnet",
    fiatAmount: "24.00",
    fiatCurrency: "USD",
    usdPerBsv: 50,
    rateSource: "static",
    xpub: accountXpub(),
    derivationIndex: 0,
    ttlSeconds: 900,
    now: new Date("2026-09-29T12:00:00.000Z"),
    paymail: "hats@example.com",
    ...overrides,
  });
}

function txPaying(scriptHex: string, satoshis: number, extra?: { scriptHex: string; satoshis: number }): Transaction {
  const outputs = [
    { satoshis, lockingScript: Script.fromHex(scriptHex) },
    ...(extra ? [{ satoshis: extra.satoshis, lockingScript: Script.fromHex(extra.scriptHex) }] : []),
  ];
  return new Transaction(1, [], outputs);
}

test("parses fiat cents and prices a quote in satoshis", () => {
  assert.equal(parseFiatCents("24"), 2400);
  assert.equal(parseFiatCents("24.5"), 2450);
  assert.equal(parseFiatCents("0.01"), 1);
  assert.throws(() => parseFiatCents("24.555"), /2 decimal/);
  assert.throws(() => parseFiatCents("0"), /positive/);
  // $24 at $50/BSV = 0.48 BSV = 48_000_000 sats
  assert.equal(centsToSatoshis(2400, 50), 48_000_000);
  const quote = buildQuote({
    fiatAmount: "24.00",
    fiatCurrency: "usd",
    usdPerBsv: 50,
    rateSource: "static",
    ttlSeconds: 900,
    now: new Date("2026-09-29T12:00:00.000Z"),
  });
  assert.equal(quote.satoshis, 48_000_000);
  assert.equal(quote.fiatCurrency, "USD");
  assert.equal(quote.expiresAt, "2026-09-29T12:15:00.000Z");
  assert.equal(quoteExpired(quote.expiresAt, new Date("2026-09-29T12:14:00.000Z")), false);
  assert.equal(quoteExpired(quote.expiresAt, new Date("2026-09-29T12:15:01.000Z")), true);
});

test("derives a unique testnet output per index and rejects an xpriv", () => {
  const xpub = accountXpub();
  const a = deriveReceiveOutput(xpub, 0, "testnet");
  const b = deriveReceiveOutput(xpub, 1, "testnet");
  const again = deriveReceiveOutput(xpub, 0, "testnet");
  assert.notEqual(a.address, b.address);
  assert.equal(a.address, again.address);
  assert.equal(a.derivationPath, "m/0/0");
  assert.match(a.address, /^[mn2]/);
  assert.match(a.lockingScriptHex, /^76a914[0-9a-f]+88ac$/);
  const main = deriveReceiveOutput(xpub, 0, "mainnet");
  assert.match(main.address, /^1/);
  assert.notEqual(main.address, a.address);
  const priv = HD.fromSeed(Array.from({ length: 64 }, () => 1)).toString();
  assert.throws(() => deriveReceiveOutput(priv, 0, "testnet"), /extended public key/);
});

test("builds a payment request with BIP21, paymail, and a stable script", () => {
  const request = sampleRequest();
  assert.equal(request.satoshis, 48_000_000);
  assert.equal(request.network, "testnet");
  assert.equal(request.paymail, "hats@example.com");
  assert.ok(request.bip21.startsWith(`bitcoin:${request.address}?amount=0.48`));
  assert.match(request.bip21, /label=BSV%20Hats/);
  assert.match(request.bip21, /message=order-1/);
  const other = sampleRequest({ derivationIndex: 4, orderRef: "order-4" });
  assert.notEqual(other.address, request.address);
  assert.equal(other.derivationPath, "m/0/4");
});

test("pays through a WalletClient-shaped createAction", async () => {
  const request = sampleRequest();
  let seenScript = "";
  let seenSats = 0;
  const result = await payWithWallet(
    {
      async createAction(args) {
        assert.ok(args.description.length >= 5 && args.description.length <= 50);
        seenScript = args.outputs[0]!.lockingScript;
        seenSats = args.outputs[0]!.satoshis;
        return { txid: "ab".repeat(32) };
      },
    },
    request,
  );
  assert.equal(result.txid, "ab".repeat(32));
  assert.equal(seenScript, request.lockingScriptHex);
  assert.equal(seenSats, request.satoshis);
  await assert.rejects(
    () => payWithWallet({ async createAction() { return {}; } }, request),
    /transaction id/,
  );
});

test("verifies an exact output, rejects underpayment, and emits a paid event", () => {
  const request = sampleRequest();
  const other = deriveReceiveOutput(accountXpub(), 9, "testnet");
  const exact = txPaying(request.lockingScriptHex, request.satoshis, {
    scriptHex: other.lockingScriptHex,
    satoshis: 500,
  });
  const paid = satoshisPaidToScript(exact.toHex(), request.lockingScriptHex);
  assert.equal(paid.satoshis, request.satoshis);
  assert.equal(paid.txid, exact.id("hex"));

  const verdict = verifyRawPayment({
    request,
    rawTxHex: exact.toHex(),
    now: new Date("2026-09-29T12:05:00.000Z"),
    platform: "stripe",
  });
  assert.equal(verdict.status, "paid");
  if (verdict.status !== "paid") return;
  assert.equal(verdict.event.type, "invoice.paid");
  assert.equal(verdict.event.txid, exact.id("hex"));
  assert.equal(verdict.event.simulated, false);
  assert.equal(verdict.event.platform, "stripe");
  assert.equal(verdict.event.network, "testnet");

  const short = txPaying(request.lockingScriptHex, request.satoshis - 1);
  const under = verifyRawPayment({
    request,
    rawTxHex: short.toHex(),
    now: new Date("2026-09-29T12:05:00.000Z"),
  });
  assert.equal(under.status, "underpaid");

  const late = verifyRawPayment({
    request,
    rawTxHex: exact.toHex(),
    now: new Date("2026-09-29T13:00:00.000Z"),
  });
  assert.equal(late.status, "expired");

  const submittedLate = verifyRawPayment({
    request,
    rawTxHex: exact.toHex(),
    now: new Date("2026-09-29T13:00:00.000Z"),
    submittedBeforeExpiry: true,
  });
  assert.equal(submittedLate.status, "paid");

  const invalid = verifyRawPayment({
    request,
    rawTxHex: exact.toHex(),
    now: new Date("2026-09-29T12:05:00.000Z"),
    chainStatus: {
      txid: exact.id("hex"),
      found: true,
      accepted: false,
      confirmed: false,
      invalid: true,
      source: "arc",
      detail: "DOUBLE_SPEND_ATTEMPTED",
    },
  });
  assert.equal(invalid.status, "pending");
});

test("detects a payment from chain history and ignores an unknown tx", async () => {
  const request = sampleRequest();
  const tx = txPaying(request.lockingScriptHex, request.satoshis);
  const chain: ChainReader = {
    network: "testnet",
    async getUsdPerBsv() {
      return { usdPerBsv: 50, source: "static", quotedAt: request.quotedAt };
    },
    async getAddressHistory() {
      return [{ txid: tx.id("hex"), height: 10 }];
    },
    async getRawTransaction(txid) {
      return txid === tx.id("hex") ? tx.toHex() : undefined;
    },
    async getTransactionStatus(txid) {
      return {
        txid,
        found: true,
        accepted: true,
        confirmed: true,
        invalid: false,
        source: "whatsonchain",
      };
    },
  };
  const found = await detectPayment({
    request,
    chain,
    now: new Date("2026-09-29T12:05:00.000Z"),
  });
  assert.equal(found.status, "paid");
  const missing = await detectPayment({
    request,
    chain: { ...chain, async getAddressHistory() { return []; } },
    now: new Date("2026-09-29T12:05:00.000Z"),
  });
  assert.equal(missing.status, "pending");
  const expired = await detectPayment({
    request,
    chain: { ...chain, async getAddressHistory() { return []; } },
    now: new Date("2026-09-29T13:00:00.000Z"),
  });
  assert.equal(expired.status, "expired");
});

test("reads a WhatsOnChain rate and a raw transaction through the HTTP chain", async () => {
  const calls: string[] = [];
  const reader = new HttpChainReader({
    network: "testnet",
    arcUrl: "https://arc.example",
    fetchImpl: async (url) => {
      const href = String(url);
      calls.push(href);
      if (href.includes("/exchangerate")) {
        return jsonResponse({ rate: 20.13, currency: "USD", time: 1_790_711_463 });
      }
      if (href.endsWith("/history")) {
        return jsonResponse([{ tx_hash: "cd".repeat(32), height: 12 }]);
      }
      if (href.includes("/tx/") && href.endsWith("/hex")) {
        return new Response("abcd", { status: 200 });
      }
      if (href.includes("arc.example")) {
        return jsonResponse({ txStatus: "SEEN_ON_NETWORK" });
      }
      return jsonResponse({ confirmations: 2 });
    },
  });
  const rate = await reader.getUsdPerBsv();
  assert.equal(rate.usdPerBsv, 20.13);
  assert.equal(rate.source, "whatsonchain:main");
  const history = await reader.getAddressHistory("mhapExample");
  assert.equal(history[0]?.txid, "cd".repeat(32));
  assert.equal(await reader.getRawTransaction("cd".repeat(32)), "abcd");
  const status = await reader.getTransactionStatus("cd".repeat(32));
  assert.equal(status.source, "arc");
  assert.equal(status.accepted, true);
  assert.ok(calls.some((url) => url.includes("/bsv/test/address/")));
});

test("paid event carries the txid", () => {
  const event = buildPaidEvent({
    request: sampleRequest(),
    txid: "11".repeat(32),
    paidAt: new Date("2026-09-29T12:06:00.000Z"),
    simulated: true,
  });
  assert.equal(event.type, "invoice.paid");
  assert.equal(event.simulated, true);
  assert.equal(event.txid, "11".repeat(32));
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}
