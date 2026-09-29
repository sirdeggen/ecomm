# BSV Hats · Medusa

Next.js storefront on port 3200. It uses the same invoice flow as `plugins/medusa`: the order is placed while authorization is still pending, and the panel waits for the testnet payment.

```bash
npm run dev:medusa
```

Postgres for a full Medusa server:

```bash
docker compose up -d
```

`DATABASE_URL` in `.env.example` matches that container. The storefront boots without Postgres. Generating the official Medusa backend is `npx create-medusa-app` plus `plugins/medusa/medusa-config.snippet.ts`. That backend was not started in this workspace; the provider logic is tested in `plugins/medusa`.

## Variables

| Variable | Purpose |
| --- | --- |
| `PAYMENT_SERVER_URL` / `NEXT_PUBLIC_PAYMENT_SERVER_URL` | Payment server |
| `BSV_PAY_SERVER_URL` | Same URL, the name the Medusa provider option uses |
| `BSV_NETWORK` | `testnet` |
| `ALLOW_SIMULATED_PAYMENTS` | On the payment server, enables the dev toggle |
| `DATABASE_URL` | Postgres for Medusa itself |
| `JWT_SECRET` / `COOKIE_SECRET` | Generate these for the Medusa server |
| `STORE_CORS` / `ADMIN_CORS` / `AUTH_CORS` | Origins for a full Medusa server |
| `WEBHOOK_SECRET` | Shared HMAC secret |

The dev toggle on the payment step is labeled "Simulated payment (dev only)". Leave it off to pay on testnet.
