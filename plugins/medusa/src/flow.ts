export interface BsvProviderOptions {
  serverUrl: string;
  webhookSecret?: string;
  fetchImpl?: typeof fetch;
}

export interface MedusaPaymentInput {
  amount: number;
  currency_code: string;
  data?: Record<string, unknown>;
  context?: { idempotency_key?: string };
}

export type AuthorizeStatus = "authorized" | "captured" | "pending_authorization";

/**
 * Talks to the shared payment server the way the Medusa provider methods do.
 * `amount` from Medusa is a major-unit number in current v2 starter carts (dollars, not cents)
 * when the region currency is configured that way. This helper treats `amount` as a decimal
 * major unit, which matches the BSV Hats storefront.
 */
export async function initiateBsvPayment(options: BsvProviderOptions, input: MedusaPaymentInput) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const orderRef = String(input.data?.orderRef ?? input.context?.idempotency_key ?? `medusa-${Date.now()}`);
  const response = await fetchImpl(`${options.serverUrl.replace(/\/$/, "")}/v1/invoices`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderRef,
      fiatAmount: formatAmount(input.amount),
      fiatCurrency: input.currency_code.toUpperCase(),
      platform: "medusa",
      metadata: {
        session_id: input.data?.session_id,
        cart_id: input.data?.cart_id,
      },
    }),
  });
  const invoice = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(String(invoice.message || invoice.error || "invoice create failed"));
  }
  return {
    id: String(invoice.invoiceId),
    data: invoice,
    status: "pending" as const,
  };
}

export async function authorizeBsvPayment(options: BsvProviderOptions, data: Record<string, unknown> | undefined): Promise<{
  status: AuthorizeStatus;
  data: Record<string, unknown>;
}> {
  const invoiceId = String(data?.invoiceId ?? data?.id ?? "");
  if (!invoiceId) throw new Error("Missing BSV invoice id");
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${options.serverUrl.replace(/\/$/, "")}/v1/invoices/${invoiceId}/poll`, { method: "POST" });
  const invoice = (await response.json()) as { status?: string; invoiceId?: string };
  if (invoice.status === "paid") {
    return { status: "authorized", data: { ...data, ...invoice } };
  }
  return { status: "pending_authorization", data: { ...data, ...invoice, invoiceId } };
}

export function webhookAction(payload: { data?: Record<string, unknown>; rawData?: unknown }) {
  const event = (payload.data ?? payload.rawData) as {
    type?: string;
    metadata?: { session_id?: string };
    satoshis?: number;
    invoiceId?: string;
  } | undefined;
  if (!event || event.type !== "invoice.paid") {
    return { action: "not_supported" as const };
  }
  const sessionId = event.metadata?.session_id;
  if (!sessionId) {
    return { action: "not_supported" as const, data: { invoiceId: event.invoiceId } };
  }
  return {
    action: "authorized" as const,
    data: {
      session_id: sessionId,
      amount: event.satoshis ?? 0,
    },
  };
}

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be positive");
  const cents = Math.round(amount * 100);
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}
