# WooCommerce gateway

A payment gateway the shopper selects at checkout. `process_payment` creates an invoice on the shared payment server, puts the order on hold, and the thank-you page mounts the BSV panel (wallet, QR, paymail, and the dev-only simulated toggle).

The paid webhook is `/?wc-api=bsv_pay`. It checks `X-BSV-Signature` and calls `payment_complete` with the txid.

## Merchant setup

1. Run the payment server (`BSV_NETWORK=testnet`).
2. Copy `.env.example` and export `BSV_PAY_SERVER_URL`, `BSV_PAY_PUBLIC_URL`, and `WEBHOOK_SECRET` into the WordPress environment. They match the server. `BSV_PAY_PUBLIC_URL` is the base URL the shopper's browser uses for the wallet panel. When PHP runs in Docker, the server URL can be `http://host.docker.internal:4000` while the public URL stays `http://127.0.0.1:4000`.
3. Install this directory as `wp-content/plugins/bsv-pay` and activate it. WooCommerce must be active.
4. If `BSV_PAY_SERVER_URL` is set, the gateway's default is enabled. Confirm it under WooCommerce → Settings → Payments.

No merchant dashboard account is required beyond the WordPress site.

## Variables

| Variable | Purpose |
| --- | --- |
| `BSV_NETWORK` | `testnet` (default) or `mainnet` |
| `BSV_PAY_SERVER_URL` | Payment server base URL used by PHP |
| `BSV_PAY_PUBLIC_URL` | Same server, as the shopper's browser can reach it. Defaults to `BSV_PAY_SERVER_URL` |
| `WEBHOOK_SECRET` | HMAC secret shared with the payment server |
| `WORDPRESS_DB_*` | Only for the Docker demo database |

## Local demo

See `demos/woocommerce/README.md`.

```bash
php bsv-pay/tests/client-flow.php
BSV_PAY_SERVER_URL=http://127.0.0.1:4000 php bsv-pay/tests/client-flow.php
```
