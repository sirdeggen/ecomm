import { recordBsvPayment, stripeClient } from "@ecomm/plugin-stripe";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const customType = process.env.STRIPE_CUSTOM_PAYMENT_METHOD_ID;
  if (!secret || !customType) {
    return NextResponse.json({ message: "Stripe custom payment method is not configured" }, { status: 501 });
  }
  const body = await request.json();
  const stripe = stripeClient(secret);
  const record = await recordBsvPayment(stripe, {
    amountCents: Number(body.amountCents),
    currency: "usd",
    customPaymentMethodType: customType,
    paymentReference: String(body.invoiceId),
  });
  return NextResponse.json({ id: record.id });
}
