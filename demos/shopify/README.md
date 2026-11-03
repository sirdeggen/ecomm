# BSV Hats · Shopify

Local preview of the post-checkout payment panel, port 3300. It is not a Shopify store. Deploying the extension needs a Partner account, which is not set up.

```bash
npm run dev:shopify
```

When you have the dev store:

1. Create a custom app (one app per store) with `write_orders` and `read_products` / `write_products`.
2. Install it and copy the Admin API token.
3. Add a manual payment method named Pay with BSV.
4. `npm run seed` in this demo (or `npm run seed -w @ecomm/plugin-shopify`) to create the six products.
5. From `plugins/shopify`, run the Shopify CLI against `extensions/bsv-pay` (`shopify app dev`). Set the extension setting `server_url` to the public payment server.
6. Run `npx tsx plugins/shopify/src/receiver.ts` and point invoice webhooks at it (`SHOPIFY_WEBHOOK_URL`).

## Variables

All of these are in `.env.example`.

| Variable | Missing until |
| --- | --- |
| `SHOPIFY_SHOP` | You create a dev store |
| `SHOPIFY_ADMIN_TOKEN` | You install the app |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | You create the app in the Partner Dashboard |
| `SHOPIFY_API_VERSION` | Optional, default `2025-10` |
| `SHOPIFY_WEBHOOK_URL` / `SHOPIFY_RECEIVER_PORT` | You run the receiver |
| `PAYMENT_SERVER_URL` / `NEXT_PUBLIC_PAYMENT_SERVER_URL` | Payment server, has local defaults |
| `WEBHOOK_SECRET` | You choose a shared secret |
| `BSV_NETWORK` | `testnet` |

The payment panel's simulated checkbox is dev-only. Testnet payment is the default.
