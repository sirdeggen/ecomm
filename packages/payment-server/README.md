# Payment server

Invoice create, status, tx submit, simulated pay, QR, and a signed webhook. Chain reads go through `@bsv/wallet-toolbox` (`WhatsOnChainNoServices` and `ARC`). If that package cannot be loaded, the server uses the HTTP reader in `@ecomm/bsv-core` against the same public endpoints.

```bash
cp .env.example .env
npm run start -w @ecomm/payment-server
```

`POST /v1/invoices` body: `orderRef`, `fiatAmount`, optional `fiatCurrency`, `platform`, `webhookUrl`, `metadata`.

`POST /v1/invoices/:id/simulate` works only when `ALLOW_SIMULATED_PAYMENTS=true` and the request comes from localhost.

The webhook body is the `invoice.paid` event. Header `X-BSV-Signature` is `sha256=` plus HMAC-SHA256 of the raw body using `WEBHOOK_SECRET`.

Leaving `BSV_XPUB` empty writes `data/merchant-key.json` (gitignored) with a new testnet xpub and xpriv. Do not commit that file. Do not reuse it on mainnet.

Variables are listed in `.env.example`. `BSV_NETWORK` defaults to `testnet`.
