import { WalletClient } from "@bsv/sdk";
import { BsvPayError, type PaymentRequest } from "./types.js";

/** Structural slice of WalletClient.createAction used to pay an invoice output. */
export interface WalletPayer {
  createAction(args: {
    description: string;
    outputs: Array<{
      lockingScript: string;
      satoshis: number;
      outputDescription: string;
    }>;
  }): Promise<{ txid?: string }>;
}

function clampDescription(value: string): string {
  const trimmed = value.trim();
  const padded = trimmed.length >= 5 ? trimmed : `${trimmed} payment`.padEnd(5, ".");
  return padded.slice(0, 50);
}

/**
 * One-click payment through a BRC-100 wallet (BSV Desktop speaks WalletClient).
 * Sends a single output to the invoice locking script for the quoted satoshis.
 */
export async function payWithWallet(wallet: WalletPayer, request: PaymentRequest): Promise<{ txid: string }> {
  if (request.status === "paid") {
    throw new BsvPayError("Invoice is already paid", "already_paid");
  }
  const result = await wallet.createAction({
    description: clampDescription(`Pay ${request.orderRef}`),
    outputs: [
      {
        lockingScript: request.lockingScriptHex,
        satoshis: request.satoshis,
        outputDescription: "Order payment",
      },
    ],
  });
  if (!result.txid || !/^[0-9a-fA-F]{64}$/.test(result.txid)) {
    throw new BsvPayError("Wallet did not return a transaction id", "no_txid");
  }
  return { txid: result.txid };
}

/** Browser/client helper. BSV Desktop connects when the substrate is `auto`. */
export function connectWalletClient(originator = "localhost"): WalletPayer {
  return new WalletClient("auto", originator);
}
