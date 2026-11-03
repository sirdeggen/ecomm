import { buildBip21 } from "./bip21.js";
import { deriveReceiveOutput } from "./derive.js";
import { buildQuote } from "./quote.js";
import type { BsvNetwork, PaymentRequest } from "./types.js";

export function buildPaymentRequest(input: {
  invoiceId: string;
  orderRef: string;
  network: BsvNetwork;
  fiatAmount: string;
  fiatCurrency: string;
  usdPerBsv: number;
  usdPerFiatUnit?: number;
  rateSource: string;
  xpub: string;
  derivationIndex: number;
  paymail?: string;
  ttlSeconds: number;
  now?: Date;
  label?: string;
}): PaymentRequest {
  const quote = buildQuote({
    fiatAmount: input.fiatAmount,
    fiatCurrency: input.fiatCurrency,
    usdPerBsv: input.usdPerBsv,
    usdPerFiatUnit: input.usdPerFiatUnit,
    rateSource: input.rateSource,
    ttlSeconds: input.ttlSeconds,
    now: input.now,
  });
  const output = deriveReceiveOutput(input.xpub, input.derivationIndex, input.network);
  const label = input.label ?? "BSV Hats";
  const message = input.orderRef;
  return {
    invoiceId: input.invoiceId,
    orderRef: input.orderRef,
    network: input.network,
    fiatAmount: quote.fiatAmount,
    fiatCurrency: quote.fiatCurrency,
    satoshis: quote.satoshis,
    usdPerBsv: quote.usdPerBsv,
    rateSource: quote.rateSource,
    address: output.address,
    derivationPath: output.derivationPath,
    derivationIndex: output.derivationIndex,
    lockingScriptHex: output.lockingScriptHex,
    bip21: buildBip21({ address: output.address, satoshis: quote.satoshis, label, message }),
    paymail: input.paymail,
    quotedAt: quote.quotedAt,
    expiresAt: quote.expiresAt,
    status: "pending",
  };
}
