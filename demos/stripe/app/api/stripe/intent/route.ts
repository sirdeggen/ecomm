import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ message: "STRIPE_SECRET_KEY is not set" }, { status: 501 });
  }
  const body = await request.json();
  const stripe = new Stripe(secret);
  const intent = await stripe.paymentIntents.create({
    amount: Number(body.amountCents),
    currency: body.currency || "usd",
    automatic_payment_methods: { enabled: true },
  });
  return NextResponse.json({ clientSecret: intent.client_secret, id: intent.id });
}
