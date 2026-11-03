import Stripe from "stripe";

export interface BsvStripeRecord {
  amountCents: number;
  currency: string;
  customPaymentMethodType: string;
  paymentReference: string;
}

/**
 * Body for Stripe's Payment Records API, matching the custom payment method guide:
 * the BSV payment happens off Stripe, then the merchant records it.
 * https://docs.stripe.com/payments/payment-element/custom-payment-methods
 */
export function paymentRecordParams(input: BsvStripeRecord, paymentMethodId: string, nowSeconds = Math.floor(Date.now() / 1000)) {
  return {
    amount_requested: { value: input.amountCents, currency: input.currency.toLowerCase() },
    payment_method_details: { payment_method: paymentMethodId },
    processor_details: {
      type: "custom" as const,
      custom: { payment_reference: input.paymentReference },
    },
    initiated_at: nowSeconds,
    customer_presence: "on_session" as const,
    outcome: "guaranteed" as const,
    guaranteed: { guaranteed_at: nowSeconds },
  };
}

export function customPaymentMethodElement(customPaymentMethodType: string) {
  return {
    customPaymentMethods: [
      {
        id: customPaymentMethodType,
        payment: {
          type: "static" as const,
          subtitle: "Pay with a BSV wallet",
        },
      },
    ],
  };
}

export function stripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey);
}

export async function recordBsvPayment(stripe: Stripe, input: BsvStripeRecord) {
  const paymentMethod = await stripe.paymentMethods.create({
    type: "custom",
    custom: { type: input.customPaymentMethodType },
  });
  const params = paymentRecordParams(input, paymentMethod.id);
  // The SDK method follows the documented reportPayment call. Cast keeps the call
  // stable if a minor SDK revision renames the resource before types catch up.
  const records = stripe.paymentRecords as unknown as {
    reportPayment: (body: ReturnType<typeof paymentRecordParams>) => Promise<{ id: string }>;
  };
  if (!records?.reportPayment) {
    throw new Error("This stripe package does not expose paymentRecords.reportPayment");
  }
  return records.reportPayment(params);
}
