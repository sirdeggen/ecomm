import {
  BsvPayError,
  buildPaidEvent,
  buildPaymentRequest,
  detectPayment,
  quoteExpired,
  type ChainReader,
  type PaidEvent,
} from "@ecomm/bsv-core";
import { createHash, randomBytes } from "node:crypto";
import type { ServerConfig } from "./config.js";
import { usdPerFiatUnit } from "./fx.js";
import { InvoiceStore, type StoredInvoice } from "./store.js";
import { deliverWebhook } from "./webhook.js";

export interface CreateInvoiceInput {
  orderRef: string;
  fiatAmount: string;
  fiatCurrency?: string;
  platform?: string;
  webhookUrl?: string;
  metadata?: Record<string, unknown>;
}

export class PaymentService {
  constructor(
    private readonly config: ServerConfig,
    private readonly store: InvoiceStore,
    private readonly chain: ChainReader,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async createInvoice(input: CreateInvoiceInput): Promise<StoredInvoice> {
    if (!input.orderRef?.trim()) throw new BsvPayError("orderRef is required", "bad_order");
    const platform = input.platform?.trim() || undefined;
    return this.store.mutate(async () => {
      const existing = this.store.findOpenByOrder(input.orderRef.trim(), platform);
      if (existing && !quoteExpired(existing.expiresAt)) return existing;
      const currency = (input.fiatCurrency || "USD").toUpperCase();
      const rate = this.config.staticUsdRate
        ? { usdPerBsv: this.config.staticUsdRate, source: "static", quotedAt: new Date().toISOString() }
        : await this.chain.getUsdPerBsv();
      const fx = await usdPerFiatUnit(currency, this.config.fxUrl, this.fetchImpl);
      const index = this.store.allocateIndex();
      const request = buildPaymentRequest({
        invoiceId: `inv_${randomBytes(12).toString("hex")}`,
        orderRef: input.orderRef.trim(),
        network: this.config.network,
        fiatAmount: input.fiatAmount,
        fiatCurrency: currency,
        usdPerBsv: rate.usdPerBsv,
        usdPerFiatUnit: fx,
        rateSource: rate.source,
        xpub: this.config.xpub,
        derivationIndex: index,
        paymail: this.config.paymail,
        ttlSeconds: this.config.ttlSeconds,
        label: "BSV Hats",
      });
      const stored: StoredInvoice = {
        ...request,
        webhookUrl: input.webhookUrl || this.config.defaultWebhookUrl,
        platform,
        metadata: input.metadata,
        simulated: false,
      };
      return this.store.save(stored);
    });
  }

  getInvoice(id: string): StoredInvoice {
    const invoice = this.store.get(id);
    if (!invoice) throw new BsvPayError("Invoice not found", "not_found");
    if ((invoice.status === "pending" || invoice.status === "underpaid") && quoteExpired(invoice.expiresAt)) {
      invoice.status = "expired";
      this.store.save(invoice);
    }
    return invoice;
  }

  async submitTxid(id: string, txid: string): Promise<StoredInvoice> {
    if (!/^[0-9a-fA-F]{64}$/.test(txid)) throw new BsvPayError("txid must be 64 hex characters", "bad_txid");
    const invoice = this.getInvoice(id);
    if (invoice.status === "paid") return invoice;
    const submittedBeforeExpiry = !quoteExpired(invoice.expiresAt);
    invoice.knownTxid = txid;
    invoice.submittedAt = new Date().toISOString();
    this.store.save(invoice);
    return this.applyDetection(invoice, { knownTxid: txid, submittedBeforeExpiry });
  }

  async poll(id: string): Promise<StoredInvoice> {
    const invoice = this.getInvoice(id);
    if (invoice.status === "paid" || invoice.status === "expired") return invoice;
    return this.applyDetection(invoice, {
      knownTxid: invoice.knownTxid,
      submittedBeforeExpiry: Boolean(invoice.submittedAt) && invoice.submittedAt! <= invoice.expiresAt,
    });
  }

  async simulate(id: string, remoteAddress: string | undefined): Promise<StoredInvoice> {
    if (!this.config.allowSimulated) {
      throw new BsvPayError("Simulated payments are disabled", "simulate_disabled");
    }
    if (!isLoopback(remoteAddress)) {
      throw new BsvPayError("Simulated payments are only accepted from localhost", "simulate_remote");
    }
    const invoice = this.getInvoice(id);
    if (invoice.status === "paid") return invoice;
    if (invoice.status === "expired") throw new BsvPayError("Invoice has expired", "expired");
    const txid = createHash("sha256").update(`simulated:${invoice.invoiceId}`).digest("hex");
    invoice.status = "paid";
    invoice.simulated = true;
    invoice.txid = txid;
    invoice.paidAt = new Date().toISOString();
    invoice.satoshisReceived = invoice.satoshis;
    this.store.save(invoice);
    await this.emitPaid(invoice, txid, true);
    return invoice;
  }

  private async applyDetection(
    invoice: StoredInvoice,
    extra: { knownTxid?: string; submittedBeforeExpiry?: boolean },
  ): Promise<StoredInvoice> {
    const verdict = await detectPayment({
      request: invoice,
      chain: this.chain,
      knownTxid: extra.knownTxid,
      submittedBeforeExpiry: extra.submittedBeforeExpiry,
      platform: invoice.platform,
    });
    if (verdict.status === "paid") {
      invoice.status = "paid";
      invoice.txid = verdict.txid;
      invoice.paidAt = verdict.event.paidAt;
      invoice.satoshisReceived = verdict.satoshisReceived;
      invoice.simulated = false;
      this.store.save(invoice);
      await this.emitPaid(invoice, verdict.txid, false);
      return invoice;
    }
    if (verdict.status === "underpaid") {
      invoice.status = "underpaid";
      invoice.satoshisReceived = verdict.satoshisReceived;
      invoice.txid = verdict.txid;
    } else if (verdict.status === "expired") {
      invoice.status = "expired";
    }
    return this.store.save(invoice);
  }

  private async emitPaid(invoice: StoredInvoice, txid: string, simulated: boolean): Promise<void> {
    if (!invoice.webhookUrl) return;
    const event: PaidEvent = buildPaidEvent({
      request: invoice,
      txid,
      paidAt: invoice.paidAt ? new Date(invoice.paidAt) : new Date(),
      simulated,
      platform: invoice.platform,
      metadata: invoice.metadata,
    });
    try {
      await deliverWebhook(invoice.webhookUrl, event, this.config.webhookSecret);
    } catch (error) {
      console.warn(`Webhook delivery failed for ${invoice.invoiceId}: ${(error as Error).message}`);
    }
  }
}

function isLoopback(address: string | undefined): boolean {
  if (!address) return false;
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}
