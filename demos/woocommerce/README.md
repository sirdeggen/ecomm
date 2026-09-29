# BSV Hats · WooCommerce

Local WordPress shop. Six virtual hats, gateway "Pay with BSV", testnet.

## Setup

1. Start the payment server from the repo root (`npm run start:server`) with `ALLOW_SIMULATED_PAYMENTS=true` if you want the dev toggle.
2. Build the checkout bundle once: `npm run build:checkout` (already copied into the plugin assets when the repo was built).
3. From this directory:

```bash
bash scripts/setup.sh
```

Open http://localhost:8080 and log in at `/wp-admin` with `admin` / `admin`.

The compose file publishes port 8080. PHP calls the payment server at `BSV_PAY_SERVER_URL` (`http://host.docker.internal:4000`). The thank-you page loads the wallet panel from `BSV_PAY_PUBLIC_URL` (`http://127.0.0.1:4000`), which is the URL the shopper's browser can reach.

The shop uses the classic theme in `theme/bsv-hats` (navy, gold, cream). Checkout uses the classic `[woocommerce_checkout]` shortcode. The block checkout hides classic gateways that do not register a Checkout Block integration, so `scripts/setup.sh` switches that page to the shortcode.

On a normal Docker bridge, WordPress reaches MySQL at the service name `db`. This environment's bridge drops container-to-container TCP, so the committed compose publishes MySQL on port 3306 and sets `WORDPRESS_DB_HOST=host.docker.internal`. If your Docker network can route between containers, set `WORDPRESS_DB_HOST=db` and drop the published MySQL port.

## Variables

See `.env.example`. The gateway reads `BSV_PAY_SERVER_URL`, `WEBHOOK_SECRET`, and `BSV_NETWORK`. Database variables are only for MySQL in Compose.

## Checkout

Add a hat, choose **Pay with BSV**, place the order. The thank-you page shows the wallet button, QR, and paymail. The simulated checkbox is labeled dev-only. A simulated pay calls the payment server, which webhooks WordPress, which marks the order paid.

Real testnet pay needs BSV Desktop (or another WalletClient) and testnet coins. That path is the default; the checkbox starts unchecked.
