# Stripe custom payment method

"Pay with BSV" is a [custom payment method](https://docs.stripe.com/payments/payment-element/custom-payment-methods) in the Payment Element, next to cards. Stripe does not move the BSV. After the testnet payment is seen, `recordBsvPayment` creates a `type: custom` PaymentMethod and reports a Payment Record, which is the path in Stripe's guide.

Dashboard step (test mode): Settings → Payments → Custom payment methods. Create "Pay with BSV" and copy the id that starts with `cpmt_`.

## Variables

| Variable | Purpose |
| --- | --- |
| `BSV_NETWORK` | `testnet` |
| `STRIPE_SECRET_KEY` | Test secret key (`sk_test_…`). The account owner creates this |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Test publishable key (`pk_test_…`) |
| `STRIPE_CUSTOM_PAYMENT_METHOD_ID` | `cpmt_…` from the Dashboard |
| `PAYMENT_SERVER_URL` | Server-side payment server |
| `NEXT_PUBLIC_PAYMENT_SERVER_URL` | Browser payment server (QR, submit, simulate) |
| `WEBHOOK_SECRET` | Shared HMAC secret |

Without those Stripe keys the demo still runs. It shows a labeled stand-in of the Payment Element and the real BSV panel.
