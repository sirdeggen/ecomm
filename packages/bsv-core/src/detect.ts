import type { ChainReader, PaidEvent, PaymentRequest } from "./types.js";
import { quoteExpired } from "./quote.js";
import { verifyRawPayment, type Verification } from "./verify.js";

const MAX_HISTORY = 25;

/**
 * Look for a payment to the invoice's unique output.
 * Checks an optional known txid first, then WhatsOnChain address history.
 */
export async function detectPayment(input: {
  request: PaymentRequest;
  chain: ChainReader;
  knownTxid?: string;
  now?: Date;
  submittedBeforeExpiry?: boolean;
  platform?: string;
}): Promise<Verification> {
  const now = input.now ?? new Date();
  if (input.request.status === "paid" && input.knownTxid) {
    const event: PaidEvent = {
      type: "invoice.paid",
      invoiceId: input.request.invoiceId,
      orderRef: input.request.orderRef,
      txid: input.knownTxid,
      satoshis: input.request.satoshis,
      network: input.request.network,
      paidAt: now.toISOString(),
      simulated: false,
      platform: input.platform,
    };
    return { status: "paid", txid: input.knownTxid, satoshisReceived: input.request.satoshis, event };
  }

  const expired = quoteExpired(input.request.expiresAt, now);
  if (expired && !input.submittedBeforeExpiry && !input.knownTxid) {
    return { status: "expired" };
  }

  const txids: string[] = [];
  if (input.knownTxid) txids.push(input.knownTxid);
  if (!input.knownTxid) {
    const history = await input.chain.getAddressHistory(input.request.address, input.request.lockingScriptHex);
    for (const item of history.slice(0, MAX_HISTORY)) txids.push(item.txid);
  }

  let underpaid: Verification | undefined;
  for (const txid of txids) {
    const [raw, chainStatus] = await Promise.all([
      input.chain.getRawTransaction(txid),
      input.chain.getTransactionStatus(txid),
    ]);
    if (!raw) continue;
    const verdict = verifyRawPayment({
      request: input.request,
      rawTxHex: raw,
      chainStatus,
      now,
      submittedBeforeExpiry: input.submittedBeforeExpiry || Boolean(input.knownTxid),
      platform: input.platform,
    });
    if (verdict.status === "paid") return verdict;
    if (verdict.status === "underpaid") underpaid = verdict;
  }

  if (underpaid) return underpaid;
  if (expired && !input.submittedBeforeExpiry) return { status: "expired" };
  return { status: "pending" };
}
