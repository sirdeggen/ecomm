import { BsvPayError } from "./types.js";

/** Parse a fiat decimal with at most two places into integer cents. */
export function parseFiatCents(amount: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) {
    throw new BsvPayError(
      "Fiat amount must be a positive number with at most 2 decimal places",
      "bad_amount",
    );
  }
  const cents = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new BsvPayError("Fiat amount must be positive", "bad_amount");
  }
  return cents;
}

export function formatFiat(cents: number): string {
  const whole = Math.floor(cents / 100);
  const frac = String(cents % 100).padStart(2, "0");
  return `${whole}.${frac}`;
}

/**
 * Convert fiat cents to satoshis.
 * `usdPerBsv` is the USD price of one BSV. `usdPerFiatUnit` converts the fiat currency into USD.
 */
export function centsToSatoshis(cents: number, usdPerBsv: number, usdPerFiatUnit = 1): number {
  if (!(usdPerBsv > 0) || !Number.isFinite(usdPerBsv)) {
    throw new BsvPayError("Exchange rate must be a positive number", "bad_rate");
  }
  if (!(usdPerFiatUnit > 0) || !Number.isFinite(usdPerFiatUnit)) {
    throw new BsvPayError("FX rate must be a positive number", "bad_fx");
  }
  const usdCents = cents * usdPerFiatUnit;
  const sats = Math.round((usdCents * 1e8) / (usdPerBsv * 100));
  if (!Number.isSafeInteger(sats) || sats < 1) {
    throw new BsvPayError("Quoted amount is below 1 satoshi", "dust");
  }
  return sats;
}

export function satoshisToBsvString(satoshis: number): string {
  const whole = Math.floor(satoshis / 1e8);
  const frac = String(satoshis % 1e8).padStart(8, "0").replace(/0+$/, "");
  return frac.length > 0 ? `${whole}.${frac}` : String(whole);
}
