import { satoshisToBsvString } from "./money.js";

export function buildBip21(input: {
  address: string;
  satoshis: number;
  label?: string;
  message?: string;
}): string {
  const params = new URLSearchParams();
  params.set("amount", satoshisToBsvString(input.satoshis));
  if (input.label) params.set("label", input.label);
  if (input.message) params.set("message", input.message);
  const query = params.toString().replace(/\+/g, "%20");
  return `bitcoin:${input.address}?${query}`;
}
