import type { AddressHistoryItem, BsvNetwork, ChainReader, TxStatus } from "./types.js";

export interface HttpChainOptions {
  network: BsvNetwork;
  /** ARC base URL, for example https://arc-test.taal.com */
  arcUrl?: string;
  arcApiKey?: string;
  fetchImpl?: typeof fetch;
  /** Override the rate endpoint. Defaults to WhatsOnChain mainnet exchangerate. */
  rateUrl?: string;
}

interface WocHistoryRow {
  tx_hash?: string;
  txid?: string;
  height?: number;
}

/**
 * WhatsOnChain + ARC reader.
 * The fiat rate always comes from the public mainnet exchangerate: testnet coins are not priced
 * separately, and the satoshi amount should match the sticker price at the BSV spot rate.
 */
export class HttpChainReader implements ChainReader {
  readonly network: BsvNetwork;
  private readonly fetchImpl: typeof fetch;
  private readonly wocBase: string;
  private readonly arcUrl?: string;
  private readonly arcApiKey?: string;
  private readonly rateUrl: string;

  constructor(options: HttpChainOptions) {
    this.network = options.network;
    this.fetchImpl = options.fetchImpl ?? fetch;
    const net = options.network === "testnet" ? "test" : "main";
    this.wocBase = `https://api.whatsonchain.com/v1/bsv/${net}`;
    this.arcUrl = options.arcUrl?.replace(/\/$/, "");
    this.arcApiKey = options.arcApiKey;
    this.rateUrl = options.rateUrl ?? "https://api.whatsonchain.com/v1/bsv/main/exchangerate";
  }

  async getUsdPerBsv(): Promise<{ usdPerBsv: number; source: string; quotedAt: string }> {
    const response = await this.fetchImpl(this.rateUrl);
    if (!response.ok) {
      throw new Error(`WhatsOnChain exchangerate HTTP ${response.status}`);
    }
    const body = (await response.json()) as { rate?: number; currency?: string; time?: number };
    if (body.currency && body.currency !== "USD") {
      throw new Error(`Unexpected rate currency ${body.currency}`);
    }
    if (!(typeof body.rate === "number") || !(body.rate > 0)) {
      throw new Error("WhatsOnChain exchangerate did not include a positive USD rate");
    }
    const quotedAt = typeof body.time === "number" ? new Date(body.time * 1000).toISOString() : new Date().toISOString();
    return { usdPerBsv: body.rate, source: "whatsonchain:main", quotedAt };
  }

  async getAddressHistory(address: string): Promise<AddressHistoryItem[]> {
    const response = await this.fetchImpl(`${this.wocBase}/address/${address}/history`);
    if (response.status === 404) return [];
    if (!response.ok) {
      throw new Error(`WhatsOnChain history HTTP ${response.status}`);
    }
    const body = (await response.json()) as WocHistoryRow[] | { history?: WocHistoryRow[] };
    const rows = Array.isArray(body) ? body : (body.history ?? []);
    return rows
      .map((row) => ({ txid: row.tx_hash ?? row.txid ?? "", height: row.height }))
      .filter((row) => /^[0-9a-fA-F]{64}$/.test(row.txid));
  }

  async getRawTransaction(txid: string): Promise<string | undefined> {
    const response = await this.fetchImpl(`${this.wocBase}/tx/${txid}/hex`);
    if (response.status === 404) return undefined;
    if (!response.ok) {
      throw new Error(`WhatsOnChain raw tx HTTP ${response.status}`);
    }
    const text = (await response.text()).trim();
    if (text.startsWith("{")) {
      const body = JSON.parse(text) as { hex?: string };
      return body.hex;
    }
    const hex = text.replace(/^"|"$/g, "");
    return /^[0-9a-fA-F]+$/.test(hex) ? hex : undefined;
  }

  async getTransactionStatus(txid: string): Promise<TxStatus> {
    const arc = await this.arcStatus(txid);
    if (arc) return arc;
    return this.wocStatus(txid);
  }

  private async arcStatus(txid: string): Promise<TxStatus | undefined> {
    if (!this.arcUrl) return undefined;
    const headers: Record<string, string> = {};
    if (this.arcApiKey) headers.Authorization = `Bearer ${this.arcApiKey}`;
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.arcUrl}/v1/tx/${txid}`, { headers });
    } catch {
      return undefined;
    }
    if (response.status === 401 || response.status === 403 || response.status === 404) return undefined;
    if (!response.ok) return undefined;
    const body = (await response.json()) as { txStatus?: string; blockHeight?: number };
    const txStatus = body.txStatus ?? "";
    const invalid = txStatus === "INVALID" || txStatus === "MALFORMED" || txStatus === "REJECTED" || txStatus === "DOUBLE_SPEND_ATTEMPTED";
    const accepted = [
      "RECEIVED",
      "STORED",
      "SENT_TO_NETWORK",
      "ANNOUNCED_TO_NETWORK",
      "ACCEPTED_BY_NETWORK",
      "SEEN_ON_NETWORK",
      "MINED",
      "IMMUTABLE",
    ].includes(txStatus);
    return {
      txid,
      found: Boolean(txStatus),
      accepted,
      confirmed: txStatus === "MINED" || txStatus === "IMMUTABLE" || (body.blockHeight ?? 0) > 0,
      invalid,
      source: "arc",
      detail: txStatus,
    };
  }

  private async wocStatus(txid: string): Promise<TxStatus> {
    const response = await this.fetchImpl(`${this.wocBase}/tx/hash/${txid}`);
    if (response.status === 404) {
      return { txid, found: false, accepted: false, confirmed: false, invalid: false, source: "none" };
    }
    if (!response.ok) {
      return { txid, found: false, accepted: false, confirmed: false, invalid: false, source: "none", detail: `HTTP ${response.status}` };
    }
    const body = (await response.json()) as { blockheight?: number; confirmations?: number; error?: string };
    if (body.error) {
      return { txid, found: false, accepted: false, confirmed: false, invalid: false, source: "whatsonchain", detail: body.error };
    }
    const confirmed = (body.confirmations ?? 0) > 0 || (body.blockheight ?? 0) > 0;
    return {
      txid,
      found: true,
      accepted: true,
      confirmed,
      invalid: false,
      source: "whatsonchain",
      detail: confirmed ? "confirmed" : "seen",
    };
  }
}
