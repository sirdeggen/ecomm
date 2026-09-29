import { centsToSatoshis, formatFiat, parseFiatCents } from "./money.js";
import { BsvPayError, type FiatQuote } from "./types.js";

const MIN_TTL_SECONDS = 60;
const MAX_TTL_SECONDS = 24 * 60 * 60;

export function buildQuote(input: {
  fiatAmount: string;
  fiatCurrency: string;
  usdPerBsv: number;
  usdPerFiatUnit?: number;
  rateSource: string;
  ttlSeconds: number;
  now?: Date;
}): FiatQuote {
  const currency = input.fiatCurrency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new BsvPayError("Fiat currency must be a 3-letter code", "bad_currency");
  }
  if (!Number.isInteger(input.ttlSeconds) || input.ttlSeconds < MIN_TTL_SECONDS || input.ttlSeconds > MAX_TTL_SECONDS) {
    throw new BsvPayError(`Quote TTL must be between ${MIN_TTL_SECONDS} and ${MAX_TTL_SECONDS} seconds`, "bad_ttl");
  }
  const cents = parseFiatCents(input.fiatAmount);
  const usdPerFiatUnit = input.usdPerFiatUnit ?? (currency === "USD" ? 1 : NaN);
  if (currency !== "USD" && !(usdPerFiatUnit > 0)) {
    throw new BsvPayError(`No USD conversion for ${currency}`, "bad_fx");
  }
  const now = input.now ?? new Date();
  const satoshis = centsToSatoshis(cents, input.usdPerBsv, usdPerFiatUnit);
  return {
    fiatAmount: formatFiat(cents),
    fiatCurrency: currency,
    fiatCents: cents,
    usdPerFiatUnit,
    usdPerBsv: input.usdPerBsv,
    satoshis,
    rateSource: input.rateSource,
    quotedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + input.ttlSeconds * 1000).toISOString(),
  };
}

export function quoteExpired(expiresAt: string, now: Date = new Date()): boolean {
  const expiry = Date.parse(expiresAt);
  if (Number.isNaN(expiry)) return true;
  return now.getTime() > expiry;
}
