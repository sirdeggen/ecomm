# Medusa v2 provider

`BsvPaymentProviderService` (`identifier: bsv-pay`) creates an invoice in `initiatePayment`. `authorizePayment` polls the payment server. Until the invoice is paid it returns `pending_authorization`, so Medusa can complete the cart into an order that is awaiting payment (documented for Medusa v2.17.2 and later). When a later authorize or the payment webhook sees `invoice.paid` with `metadata.session_id`, the provider returns `authorized`.

Register it from `medusa-config.snippet.ts`.

The class extends `AbstractPaymentProvider` from `@medusajs/framework`. The unit test covers `src/flow.ts` (initiate, pending, authorized, webhook) without booting Medusa.

## Variables

| Variable | Purpose |
| --- | --- |
| `BSV_NETWORK` | `testnet` |
| `BSV_PAY_SERVER_URL` | Passed as `options.serverUrl` |
| `WEBHOOK_SECRET` | Verify the payment webhook if you terminate it in Medusa |
| `DATABASE_URL` | Postgres for the Medusa server |
| `JWT_SECRET` / `COOKIE_SECRET` | Medusa session secrets. You generate them |
| `STORE_CORS` / `ADMIN_CORS` / `AUTH_CORS` | Origins for the Medusa HTTP server |

No Medusa Cloud account is required to run locally.

## Full backend

```bash
docker compose -f demos/medusa/docker-compose.yml up -d
npx create-medusa-app@latest bsv-hats-backend --db-url postgres://medusa:medusa@127.0.0.1:5432/medusa
```

Point the payment module at this package using the snippet, set the region currency to USD, and enable the `pp_bsv-pay_bsv` provider on that region. The Next.js starter that command generates is the storefront Medusa ships; `demos/medusa` is the BSV Hats storefront that already speaks this provider's payment server.
