# BSV e-commerce payments

Testnet payment plugins for five shops, plus a BSV Hats demo for each. The merchant sets a few environment variables. The shopper pays from a BRC-100 wallet (BSV Desktop speaks `WalletClient`) in one click, or scans a BIP21 QR, or uses the paymail fallback. There is no shopper account.

`BSV_NETWORK` defaults to `testnet`.

## Comparison

| Platform | Mechanism | Approval | Sandbox | Status here |
| --- | --- | --- | --- | --- |
| WooCommerce | Native payment gateway (`WC_Payment_Gateway`) | None | Docker Compose in `demos/woocommerce` (WordPress + MySQL). `wp-env` is an alternative if you already use it | Runnable locally, including simulated pay |
| Shopify | Manual payment method, then a Thank you / Order status checkout UI extension. The backend calls [`orderMarkAsPaid`](https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderMarkAsPaid) | A custom app is installed per store. Shopify's payments-app program is separate and access is controlled by Shopify; this repo does not use it | Partner dev store. No Partner account is configured in this environment | Plugin, extension source, and hat seed script are in the repo. The local demo previews the payment panel |
| Stripe | [Custom payment method](https://docs.stripe.com/payments/payment-element/custom-payment-methods) in the Payment Element. BSV is charged off Stripe and can be recorded with the Payment Records API | A Stripe account, plus a custom payment method type (`cpmt_…`) created in the Dashboard | Stripe test mode | Next.js store runs locally. Without test keys it shows a labeled stand-in for the Payment Element and still completes BSV checkout |
| Medusa v2 | Payment module provider. `authorizePayment` returns `pending_authorization` until the invoice is paid ([awaiting-payment flow](https://docs.medusajs.com/resources/commerce-modules/payment/payment-flow), Medusa v2.17.2+) | None | Local Node + Postgres | Next.js BSV Hats storefront runs locally against the payment server. Postgres compose is included. The official `create-medusa-app` backend is not vendored |
| BigCommerce | Offline method renamed to "Pay with BSV", an order-confirmation script, then `PUT /v2/orders/{id}` to move status | No custom gateway. A Technology Partner account is required for a sandbox store | Not available here | Plugin, confirmation script, and catalog seed are in the repo. The local demo previews the panel |

## Architecture

```
shopper wallet (WalletClient / QR / paymail)
        │
        ▼
packages/checkout-ui  ──►  packages/payment-server
                                │
                                ├─ @ecomm/bsv-core   quote, unique output, verify, paid event
                                └─ @bsv/wallet-toolbox   WhatsOnChain + ARC
                                        │
                                        ▼
                                 webhook (HMAC)
                                        │
          ┌─────────────┬───────────────┼───────────────┬──────────────┐
          ▼             ▼               ▼               ▼              ▼
     WooCommerce    Shopify         Stripe          Medusa      BigCommerce
     gateway        orderMarkAsPaid Payment Record  provider    order status
```

Each order gets its own quote and its own P2PKH output:

1. Fiat amount is converted to satoshis with the public WhatsOnChain mainnet BSV/USD rate (testnet coins are not priced on their own; the quote matches the sticker price). Non-USD amounts are converted via the Frankfurter API first. The quote expires (default 15 minutes).
2. The server derives `m/0/{index}` from `BSV_XPUB`. The index increases per invoice.
3. The shopper's wallet calls `createAction` with that locking script, or pays the BIP21 URI in the QR. A configured paymail is shown as a fallback; automatic detection still watches the unique address.
4. The server loads the raw transaction through `@bsv/wallet-toolbox` (`WhatsOnChainNoServices`, and ARC when `ARC_API_KEY` is set) and checks the output. A matching payment emits `invoice.paid` with the txid.
5. The platform adapter marks the order paid.

Public testnet ARC (`https://arc-test.taal.com`) responds 401 without an API key. Verification still uses WhatsOnChain testnet in that case. An ARC status of invalid or double-spend rejects the transaction.

Simulated payment is off unless `ALLOW_SIMULATED_PAYMENTS=true`. The checkbox is labeled as dev-only and does not broadcast.

## Quick start

```bash
npm install
cp packages/payment-server/.env.example packages/payment-server/.env
# edit WEBHOOK_SECRET if you like; BSV_NETWORK=testnet is already set
npm run build:checkout
npm run start:server
```

In another shell:

```bash
npm run dev:stripe      # http://127.0.0.1:3100
npm run dev:medusa      # http://127.0.0.1:3200
npm run dev:shopify     # http://127.0.0.1:3300
npm run dev:bigcommerce # http://127.0.0.1:3400
```

WooCommerce:

```bash
cd demos/woocommerce && bash scripts/setup.sh
```

That starts WordPress at http://localhost:8080 (`admin` / `admin`). The payment server must already be listening on port 4000.

Tests:

```bash
npm test
```

## BigCommerce fee (from BigCommerce's pages, not from a live invoice)

BigCommerce's [June 2026 pricing update](https://www.bigcommerce.com/dm/plan-pricing-updates-2026/) lists an Open Payment Provider fee on self-serve plans: 2.0% (Core), 1.0% (Growth), 0.6% (Scale). It says contracted Performance plans are not charged this fee. The [pricing support article](https://support.bigcommerce.com/s/article/Pricing) says orders processed through offline payment methods are included, and its Scale example multiplies by 0.006. The [offline payment methods article](https://support.bigcommerce.com/s/article/Offline-Payment-Methods) describes Bank Deposit, Cash on Delivery, Check, Money Order, and Pay in Store; orders start in Awaiting Payment and are updated when money arrives.

This repo has not checked those rates against a merchant invoice or a partner agreement. The fee must not be added on top of the shopper's total; BigCommerce says the charge is to the merchant.

## Layout

- `packages/bsv-core` — quote, derivation, WalletClient payment, ARC / WhatsOnChain verification, paid event
- `packages/payment-server` — `POST /v1/invoices`, status, submit, simulate, QR, signed webhook
- `packages/checkout-ui` — shopper panel
- `packages/storefront` — shared BSV Hats UI
- `plugins/*` — platform adapters
- `demos/*` — one shop each
- `docs/screenshots` — local runs

## Credentials that are not in this environment

Someone with access to the merchant accounts has to create:

- **Stripe:** a test-mode secret key, publishable key, and a custom payment method id (`cpmt_…`) in the Dashboard.
- **Shopify:** a Partner account, a dev store, a custom app with `write_orders` (and the staff permission to mark orders paid), and the Admin API token. One app per store.
- **BigCommerce:** a Technology Partner (or other) account that can issue a store API token (`store hash` + `X-Auth-Token`).
- **WooCommerce and Medusa:** no third-party account. WooCommerce needs Docker. A full Medusa server needs Postgres (`demos/medusa/docker-compose.yml`) and `npx create-medusa-app`, then the provider snippet in `plugins/medusa/medusa-config.snippet.ts`.

Every variable is listed in the `.env.example` next to each plugin and demo, and again in those READMEs.
