# Shopify

Shopify's checkout does not let an extension insert a new payment method in the payment list ([payment targets are read-only](https://shopify.dev/docs/api/checkout-ui-extensions/2026-01/targets/checkout/payment)). This plugin follows the manual-payment pattern:

1. In the store admin, add a manual payment method named **Pay with BSV**. Instructions can say the shopper pays on the next page.
2. The checkout UI extension (`extensions/bsv-pay`) renders on the Thank you page (`purchase.thank-you.block.render`) and the Order status page (`customer-account.order-status.block.render`). Thank you runs before some order fields settle; the order id is what you key on. See [Thank you and Order status](https://shopify.dev/docs/apps/build/checkout/thank-you-order-status).
3. The extension cannot mutate the order. `src/receiver.ts` accepts the payment-server webhook and calls [`orderMarkAsPaid`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderMarkAsPaid). That mutation needs `write_orders` and the staff permission to mark orders as paid.

One custom app is installed on one store. Create the app in the Partner Dashboard, put the client id in `shopify.app.toml`, then `shopify app dev` from this directory once the Shopify CLI and a Partner account exist.

This was not deployed here. There is no Partner account in the environment.

## Variables

| Variable | Who creates it |
| --- | --- |
| `SHOPIFY_SHOP` | The dev store's `*.myshopify.com` host |
| `SHOPIFY_ADMIN_TOKEN` | Custom app Admin API token, after install |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | Partner Dashboard app credentials |
| `SHOPIFY_API_VERSION` | Defaults to `2025-10` |
| `SHOPIFY_WEBHOOK_URL` | URL of `src/receiver.ts` |
| `SHOPIFY_RECEIVER_PORT` | Default `4100` |
| `WEBHOOK_SECRET` | Same as the payment server |
| `PAYMENT_SERVER_URL` | Payment server |
| `BSV_NETWORK` | `testnet` |

Seed hats after the token exists:

```bash
npm run seed -w @ecomm/plugin-shopify
```

`productCreate` in the seed sets title, description, and vendor. Add a price in the admin or extend the mutation with a variant price before taking real orders. The local BSV Hats demo does not wait on that token.
