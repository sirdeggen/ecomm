# BigCommerce

BigCommerce does not offer a self-serve custom card gateway. This adapter uses an [offline payment method](https://support.bigcommerce.com/s/article/Offline-Payment-Methods):

1. Settings → Payments → Offline Payment Methods. Set up Bank Deposit, Check, or Money Order.
2. Set the display name to **Pay with BSV**. The order is created in Awaiting Payment.
3. Add `scripts/order-confirmation.js` in Script Manager on the order confirmation page. Set `window.BSV_PAY = { serverUrl, orderId, fiatAmount }` from the theme if the script cannot see the order id. The DOM selector in the script was **not** checked on a live checkout. There is no sandbox store here.
4. `src/receiver.ts` verifies the payment webhook and `PUT`s `/v2/orders/{id}` with `status_id` (default `11`, the usual Awaiting Fulfillment id). Confirm ids with `GET /v2/order_statuses` on the store. Status changes are described in the [orders overview](https://docs.bigcommerce.com/developer/docs/admin/checkout-and-cart/orders/overview).

## Fee

See the root README. BigCommerce's June 2026 pricing page lists Open Payment Provider fees of 2.0% / 1.0% / 0.6% on Core / Growth / Scale, and the support article includes offline methods. That has not been confirmed on an invoice for this project.

## Variables

| Variable | Who creates it |
| --- | --- |
| `BIGCOMMERCE_STORE_HASH` | Store API path segment. A Technology Partner (or store owner) account |
| `BIGCOMMERCE_ACCESS_TOKEN` | API account token (`X-Auth-Token`) |
| `BIGCOMMERCE_CLIENT_ID` / `BIGCOMMERCE_CLIENT_SECRET` | App credentials if you use OAuth instead of a store token |
| `BIGCOMMERCE_PAID_STATUS_ID` | Default `11`. Override after reading `/v2/order_statuses` |
| `BIGCOMMERCE_WEBHOOK_URL` | Receiver URL, passed on invoice create |
| `BIGCOMMERCE_RECEIVER_PORT` | Default `4101` |
| `PAYMENT_SERVER_URL` | Payment server |
| `WEBHOOK_SECRET` | Shared HMAC secret |
| `BSV_NETWORK` | `testnet` |

```bash
npm run seed -w @ecomm/plugin-bigcommerce
```

That posts the six hats to `/v3/catalog/products` once the token exists.
