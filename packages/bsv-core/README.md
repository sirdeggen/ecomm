# @ecomm/bsv-core

Quote a fiat amount in satoshis, derive a unique testnet (or mainnet) output per order, pay it with `WalletClient`, and verify the transaction.

The rate comes from WhatsOnChain `GET /v1/bsv/main/exchangerate` (USD per BSV). Testnet payments use that same spot rate so the satoshi amount matches the price on the tag. Quotes expire. Each index on `m/0/{index}` from the account xpub is one invoice.

`payWithWallet` calls `createAction` with a single output. Verification parses the raw transaction and sums outputs paying the invoice script. ARC statuses that mean invalid or double-spend are rejected. A missing ARC response does not, because the public testnet ARC requires an API key.

```bash
npm test -w @ecomm/bsv-core
```
