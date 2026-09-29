import { HD, P2PKH } from "@bsv/sdk";
import { BsvPayError, type BsvNetwork } from "./types.js";

export interface DerivedOutput {
  address: string;
  derivationPath: string;
  derivationIndex: number;
  lockingScriptHex: string;
}

/**
 * Derive a unique P2PKH output from an extended public key.
 * `xpub` is treated as the account node. Invoice `index` uses non-hardened path `m/0/{index}`.
 */
export function deriveReceiveOutput(xpub: string, index: number, network: BsvNetwork): DerivedOutput {
  if (!Number.isInteger(index) || index < 0 || index > 0x7fffffff) {
    throw new BsvPayError("Derivation index is out of range", "bad_index");
  }
  let node: HD;
  try {
    node = HD.fromString(xpub.trim());
  } catch (error) {
    throw new BsvPayError(`BSV_XPUB is not a valid extended key: ${(error as Error).message}`, "bad_xpub");
  }
  if (node.isPrivate()) {
    throw new BsvPayError("BSV_XPUB must be an extended public key, not an xpriv", "private_xpub");
  }
  const child = node.derive(`m/0/${index}`);
  const addressPrefix = network === "testnet" ? "testnet" : "mainnet";
  const address = child.pubKey.toAddress(addressPrefix);
  const lockingScriptHex = new P2PKH().lock(address).toHex();
  return {
    address,
    derivationPath: `m/0/${index}`,
    derivationIndex: index,
    lockingScriptHex,
  };
}

/** Fresh testnet account xpub for local demos. The matching xpriv stays on disk, never in git. */
export function generateAccountXpub(): { xpub: string; xpriv: string } {
  const root = HD.fromRandom();
  return { xpub: root.toPublic().toString(), xpriv: root.toString() };
}
