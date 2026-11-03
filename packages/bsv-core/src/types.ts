export type BsvNetwork = "testnet" | "mainnet";

export type InvoiceStatus = "pending" | "paid" | "underpaid" | "expired";

export class BsvPayError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "BsvPayError";
    this.code = code;
  }
}

/** A locked fiat-to-BSV quote. `usdPerBsv` is USD for one BSV. */
export interface FiatQuote {
  fiatAmount: string;
  fiatCurrency: string;
  fiatCents: number;
  /** How many USD one unit of `fiatCurrency` buys. USD is 1. */
  usdPerFiatUnit: number;
  usdPerBsv: number;
  satoshis: number;
  rateSource: string;
  quotedAt: string;
  expiresAt: string;
}

export interface PaymentRequest {
  invoiceId: string;
  orderRef: string;
  network: BsvNetwork;
  fiatAmount: string;
  fiatCurrency: string;
  satoshis: number;
  usdPerBsv: number;
  rateSource: string;
  address: string;
  derivationPath: string;
  derivationIndex: number;
  lockingScriptHex: string;
  bip21: string;
  paymail?: string;
  quotedAt: string;
  expiresAt: string;
  status: InvoiceStatus;
}

export interface PaidEvent {
  type: "invoice.paid";
  invoiceId: string;
  orderRef: string;
  txid: string;
  satoshis: number;
  network: BsvNetwork;
  paidAt: string;
  simulated: boolean;
  platform?: string;
  metadata?: Record<string, unknown>;
}

export interface AddressHistoryItem {
  txid: string;
  height?: number;
}

export interface TxStatus {
  txid: string;
  found: boolean;
  accepted: boolean;
  confirmed: boolean;
  invalid: boolean;
  source: "whatsonchain" | "arc" | "none";
  detail?: string;
}

/**
 * Chain reads used to price an invoice and to notice a testnet (or mainnet) payment.
 * The payment server supplies an implementation backed by `@bsv/wallet-toolbox`.
 */
export interface ChainReader {
  network: BsvNetwork;
  getUsdPerBsv(): Promise<{ usdPerBsv: number; source: string; quotedAt: string }>;
  getAddressHistory(address: string, lockingScriptHex: string): Promise<AddressHistoryItem[]>;
  getRawTransaction(txid: string): Promise<string | undefined>;
  getTransactionStatus(txid: string): Promise<TxStatus>;
}
