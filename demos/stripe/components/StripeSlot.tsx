"use client";

import { PaymentPanel, type InvoicePayload } from "@ecomm/storefront";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useEffect, useState, type ReactNode } from "react";

const publishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "";
const customId = process.env.NEXT_PUBLIC_STRIPE_CUSTOM_PAYMENT_METHOD_ID || "";
const stripePromise = publishable ? loadStripe(publishable) : null;

export function StripeSlot(props: { invoice: InvoicePayload; fallback: ReactNode }) {
  const [clientSecret, setClientSecret] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!publishable) return;
    const cents = Math.round(Number(props.invoice.fiatAmount) * 100);
    fetch("/api/stripe/intent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ amountCents: cents, currency: "usd" }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Stripe intent failed");
        setClientSecret(body.clientSecret);
      })
      .catch((err: Error) => setError(err.message));
  }, [props.invoice.fiatAmount]);

  if (!publishable || !customId || !stripePromise) {
    return (
      <div>
        <p className="banner">
          Stripe test keys are not configured. This is a local stand-in for the Payment Element: card stays
          unavailable, and Pay with BSV is the selected method. Add the variables in .env.example to load the real
          element.
        </p>
        <div className="stripe-shell" aria-label="Payment Element stand-in">
          <div className="stripe-row">
            <span>Card</span>
            <span>Unavailable in this stand-in</span>
          </div>
          <div className="stripe-row active">
            <strong>Pay with BSV</strong>
            <span>Selected</span>
          </div>
        </div>
        {props.fallback}
      </div>
    );
  }

  if (error) return <p className="banner">{error}</p>;
  if (!clientSecret) return <p>Loading the Payment Element…</p>;

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        customPaymentMethods: [{ id: customId, payment: { type: "static", subtitle: "Pay with a BSV wallet" } }],
      }}
    >
      <RealElement invoice={props.invoice} customId={customId} />
    </Elements>
  );
}

function RealElement(props: { invoice: InvoicePayload; customId: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState("");
  const [showBsv, setShowBsv] = useState(false);

  async function onPay() {
    if (!stripe || !elements) return;
    const { error, selectedPaymentMethod } = await elements.submit();
    if (error) {
      setMessage(error.message || "Payment Element could not submit");
      return;
    }
    if (selectedPaymentMethod === props.customId) {
      setShowBsv(true);
      setMessage("Pay with BSV is selected. Complete the wallet, QR, or simulated payment below. Stripe is not charging a card.");
      return;
    }
    const result = await stripe.confirmPayment({ elements, redirect: "if_required" });
    setMessage(result.error?.message || "Card payment submitted to Stripe.");
  }

  return (
    <div className="note">
      <PaymentElement />
      <p>
        <button className="primary" type="button" onClick={onPay}>Continue</button>
      </p>
      {message && <p>{message}</p>}
      {showBsv && <PaymentPanel invoice={props.invoice} />}
    </div>
  );
}
