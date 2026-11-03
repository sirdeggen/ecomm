import { Transaction } from "@bsv/sdk";
import { quoteExpired } from "./quote.js";
import { BsvPayError, type PaidEvent, type PaymentRequest, type TxStatus } from "./types.js";

export interface OutputMatch {
  txid: string;
  satoshis: number;
}

/** Sum the satoshis of outputs whose locking script equals the invoice script. */
export function satoshisPaidToScript(rawTxHex: string, lockingScriptHex: string): OutputMatch {
  let tx: Transaction;
  try {
    tx = Transaction.fromHex(rawTxHex.trim());
  } catch (error) {
    throw new BsvPayError(`Could not parse transaction: ${(error as Error).message}`, "bad_tx");
  }
  const want = lockingScriptHex.toLowerCase();
  let total = 0;
  for (const output of tx.outputs) {
    const hex = output.lockingScript.toHex().toLowerCase();
    if (hex === want) total += output.satoshis ?? 0;
  }
  return { txid: tx.id("hex"), satoshis: total };
}

export function buildPaidEvent(input: {
  request: PaymentRequest;
  txid: string;
  paidAt?: Date;
  simulated?: boolean;
  platform?: string;
  metadata?: Record<string, unknown>;
}): PaidEvent {
  return {
    type: "invoice.paid",
    invoiceId: input.request.invoiceId,
    orderRef: input.request.orderRef,
    txid: input.txid,
    satoshis: input.request.satoshis,
    network: input.request.network,
    paidAt: (input.paidAt ?? new Date()).toISOString(),
    simulated: Boolean(input.simulated),
    platform: input.platform,
    metadata: input.metadata,
  };
}

export type Verification =
  | { status: "pending" }
  | { status: "expired" }
  | { status: "underpaid"; txid?: string; satoshisReceived: number }
  | { status: "paid"; txid: string; satoshisReceived: number; event: PaidEvent };

/**
 * Decide whether a raw transaction satisfies the invoice.
 * ARC/WhatsOnChain status is advisory: an invalid or double-spend status rejects the tx.
 * A missing ARC status (no API key on the public testnet processor) does not reject a matching output.
 */
export function verifyRawPayment(input: {
  request: PaymentRequest;
  rawTxHex: string;
  chainStatus?: TxStatus;
  now?: Date;
  /** True when the shopper submitted this txid before the quote expired. */
  submittedBeforeExpiry?: boolean;
  platform?: string;
}): Verification {
  const now = input.now ?? new Date();
  const expired = quoteExpired(input.request.expiresAt, now);
  if (expired && !input.submittedBeforeExpiry) {
    return { status: "expired" };
  }
  if (input.chainStatus?.invalid) {
    return { status: "pending" };
  }
  const match = satoshisPaidToScript(input.rawTxHex, input.request.lockingScriptHex);
  if (match.satoshis <= 0) return { status: "pending" };
  if (match.satoshis < input.request.satoshis) {
    return { status: "underpaid", txid: match.txid, satoshisReceived: match.satoshis };
  }
  return {
    status: "paid",
    txid: match.txid,
    satoshisReceived: match.satoshis,
    event: buildPaidEvent({
      request: input.request,
      txid: match.txid,
      paidAt: now,
      platform: input.platform,
    }),
  };
}
