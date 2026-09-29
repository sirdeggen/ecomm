"use client";

import { HatsShop, PaymentPanel, type InvoicePayload } from "@ecomm/storefront";
import { StripeSlot } from "../components/StripeSlot";

export default function Page() {
  return (
    <HatsShop
      platform="stripe"
      kicker="Stripe test mode · BSV testnet"
      note={
        <p>
          Pay with BSV sits beside cards. The BSV leg happens off Stripe. When test keys and a custom payment method
          id are set, this step uses the Payment Element and records the result with the Payment Records API.
        </p>
      }
      renderPayment={(invoice) => <StripeSlot invoice={invoice} fallback={<PaymentPanel invoice={invoice} />} />}
    />
  );
}

export type { InvoicePayload };
