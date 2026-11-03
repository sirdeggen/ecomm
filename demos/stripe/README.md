# BSV Hats · Stripe

Next.js store on port 3100. Six hats, same branding as the other demos.

```bash
# from the repo root, with the payment server already running
npm run dev:stripe
```

## Variables

Copy `.env.example` to `.env.local`.

| Variable | Required to boot | Required for the real Payment Element |
| --- | --- | --- |
| `PAYMENT_SERVER_URL` | Falls back to `http://127.0.0.1:4000` | |
| `NEXT_PUBLIC_PAYMENT_SERVER_URL` | Same, for the browser | |
| `BSV_NETWORK` | Documented as `testnet` | |
| `ALLOW_SIMULATED_PAYMENTS` | Set `true` on the payment server for the dev toggle | |
| `STRIPE_SECRET_KEY` | No | Yes. Test secret. You create it in the Stripe Dashboard |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | Yes |
| `STRIPE_CUSTOM_PAYMENT_METHOD_ID` | No | Yes. `cpmt_…` from Settings → Payments → Custom payment methods |
| `WEBHOOK_SECRET` | Shared with the server if you forward webhooks | |

Without Stripe keys, checkout shows a stand-in that says so, with Pay with BSV selected, then the real BSV panel. With keys, the page loads Stripe.js and the Payment Element. Choosing the custom method continues into the BSV panel. `POST /api/stripe/record` reports the payment to Stripe after you call it with the invoice id (the panel itself does not call Stripe until that route is used).

Simulated payment is the labeled checkbox. It does not create a testnet transaction.
