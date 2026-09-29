import { HttpChainReader, type BsvNetwork, type ChainReader, type HttpChainOptions, type TxStatus } from "@ecomm/bsv-core";
import { Hash, Utils } from "@bsv/sdk";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

/**
 * Chain reader that prefers `@bsv/wallet-toolbox` (WhatsOnChain + ARC).
 * If the toolbox cannot be constructed, it falls back to the HTTP reader in the core package,
 * which calls the same public endpoints.
 */
export async function createChainReader(options: HttpChainOptions & { preferToolbox?: boolean }): Promise<{
  reader: ChainReader;
  backend: "wallet-toolbox" | "http";
}> {
  if (options.preferToolbox === false) {
    return { reader: new HttpChainReader(options), backend: "http" };
  }
  try {
    const reader = await toolboxReader(options);
    return { reader, backend: "wallet-toolbox" };
  } catch (error) {
    console.warn(`wallet-toolbox chain reader unavailable (${(error as Error).message}); using HTTP WhatsOnChain/ARC reader`);
    return { reader: new HttpChainReader(options), backend: "http" };
  }
}

async function toolboxReader(options: HttpChainOptions): Promise<ChainReader> {
  const wocMod = require("@bsv/wallet-toolbox/out/src/services/providers/WhatsOnChain") as {
    WhatsOnChainNoServices: new (chain?: "main" | "test") => {
      updateBsvExchangeRate(): Promise<{ rate: number; timestamp?: Date } | undefined>;
      getScriptHashHistory(hash: string): Promise<{ status: string; history?: Array<{ txid: string; height?: number }> }>;
      getRawTx(txid: string): Promise<string | undefined>;
      getStatusForTxids(txids: string[]): Promise<{ results?: Array<{ txid: string; status: string }> }>;
    };
  };
  const arcMod = require("@bsv/wallet-toolbox/out/src/services/providers/ARC") as {
    ARC: new (url: string, apiKey?: string) => {
      URL: string;
      getTxData(txid: string): Promise<{ txStatus?: string; blockHeight?: number }>;
    };
    isArcAcceptedTxStatus(status: string): boolean;
    isArcInvalidTxStatus(status: string): boolean;
    isArcDoubleSpendTxStatus(status: string): boolean;
  };
  const chain = options.network === "testnet" ? "test" : "main";
  const woc = new wocMod.WhatsOnChainNoServices(chain);
  const arcUrl = options.arcUrl || (options.network === "testnet" ? "https://arc-test.taal.com" : "https://arc.taal.com");
  const arc = new arcMod.ARC(arcUrl, options.arcApiKey);
  const http = new HttpChainReader(options);

  return {
    network: options.network,
    async getUsdPerBsv() {
      const rate = await woc.updateBsvExchangeRate();
      if (!(rate?.rate > 0)) {
        return http.getUsdPerBsv();
      }
      const quotedAt = rate.timestamp instanceof Date ? rate.timestamp.toISOString() : new Date().toISOString();
      return { usdPerBsv: rate.rate, source: "wallet-toolbox:whatsonchain", quotedAt };
    },
    async getAddressHistory(_address: string, lockingScriptHex: string) {
      const hash = scriptHashLE(lockingScriptHex);
      const history = await woc.getScriptHashHistory(hash);
      if (history.status !== "success") return http.getAddressHistory(_address, lockingScriptHex);
      return (history.history ?? []).map((item: { txid: string; height?: number }) => ({
        txid: item.txid,
        height: item.height,
      }));
    },
    async getRawTransaction(txid: string) {
      const hex = await woc.getRawTx(txid);
      if (typeof hex === "string" && hex.length > 0) return hex;
      return http.getRawTransaction(txid);
    },
    async getTransactionStatus(txid: string): Promise<TxStatus> {
      try {
        const data = await arc.getTxData(txid);
        const txStatus = data?.txStatus ?? "";
        if (txStatus) {
          return {
            txid,
            found: true,
            accepted: arcMod.isArcAcceptedTxStatus(txStatus),
            confirmed: txStatus === "MINED" || txStatus === "IMMUTABLE" || (data.blockHeight ?? 0) > 0,
            invalid: arcMod.isArcInvalidTxStatus(txStatus) || arcMod.isArcDoubleSpendTxStatus(txStatus),
            source: "arc",
            detail: txStatus,
          };
        }
      } catch {
        // Public testnet ARC responds 401 without an API key. WhatsOnChain still confirms the tx.
      }
      const listed = await woc.getStatusForTxids([txid]);
      const row = listed.results?.find((item: { txid: string }) => item.txid === txid);
      if (row && row.status !== "unknown") {
        return {
          txid,
          found: true,
          accepted: true,
          confirmed: row.status === "mined",
          invalid: false,
          source: "whatsonchain",
          detail: row.status,
        };
      }
      return http.getTransactionStatus(txid);
    },
  };
}

function scriptHashLE(lockingScriptHex: string): string {
  const bytes = Utils.toArray(lockingScriptHex, "hex");
  const hashed = Hash.sha256(bytes);
  return Utils.toHex([...hashed].reverse());
}

export function networkOf(value: string | undefined): BsvNetwork {
  return value === "mainnet" ? "mainnet" : "testnet";
}
