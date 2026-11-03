/** Convert 1 unit of `currency` into USD. USD is 1. Other codes use the public Frankfurter API. */
export async function usdPerFiatUnit(currency: string, fxUrl: string, fetchImpl: typeof fetch = fetch): Promise<number> {
  const code = currency.toUpperCase();
  if (code === "USD") return 1;
  const response = await fetchImpl(`${fxUrl.replace(/\/$/, "")}/latest?from=${code}&to=USD`);
  if (!response.ok) {
    throw new Error(`FX rate HTTP ${response.status} for ${code}`);
  }
  const body = (await response.json()) as { rates?: { USD?: number } };
  const rate = body.rates?.USD;
  if (!(typeof rate === "number") || !(rate > 0)) {
    throw new Error(`FX rate for ${code} did not include USD`);
  }
  return rate;
}
