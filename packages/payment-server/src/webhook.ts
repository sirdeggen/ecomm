import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaidEvent } from "@ecomm/bsv-core";

export function signBody(body: string, secret: string): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

export function signaturesMatch(expected: string, received: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function deliverWebhook(url: string, event: PaidEvent, secret: string): Promise<{ ok: boolean; status: number }> {
  const body = JSON.stringify(event);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-bsv-signature": signBody(body, secret),
    },
    body,
  });
  return { ok: response.ok, status: response.status };
}
