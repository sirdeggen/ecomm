# BSV Hats · BigCommerce

Local preview of the order-confirmation payment panel, port 3400. It is not a BigCommerce store. A sandbox needs a Technology Partner account (or a store you already own). That account is not set up.

```bash
npm run dev:bigcommerce
```

When the store exists:

1. Create an API account and copy the store hash and access token.
2. Rename an offline method to Pay with BSV (see `plugins/bigcommerce/README.md`).
3. `npm run seed` to create the six products.
4. Install `plugins/bigcommerce/scripts/order-confirmation.js` on the order confirmation page.
5. Run `npx tsx plugins/bigcommerce/src/receiver.ts` so a paid invoice updates the order.

The Open Payment Provider fee (2% / 1% / 0.6% on the self-serve plans, from BigCommerce's June 2026 pricing page) is discussed in the root README. It was not verified on an invoice.

## Variables

| Variable | Missing until |
| --- | --- |
| `BIGCOMMERCE_STORE_HASH` | You have a store |
| `BIGCOMMERCE_ACCESS_TOKEN` | You create an API account |
| `BIGCOMMERCE_CLIENT_ID` / `BIGCOMMERCE_CLIENT_SECRET` | You register an app, if you use OAuth |
| `BIGCOMMERCE_PAID_STATUS_ID` | Optional. Default `11`. Confirm with the order-status API |
| `BIGCOMMERCE_WEBHOOK_URL` / `BIGCOMMERCE_RECEIVER_PORT` | You run the receiver |
| `PAYMENT_SERVER_URL` / `NEXT_PUBLIC_PAYMENT_SERVER_URL` | Local defaults work |
| `WEBHOOK_SECRET` | Shared secret you choose |
| `BSV_NETWORK` | `testnet` |

Simulated payment is the labeled checkbox. It does not broadcast.
