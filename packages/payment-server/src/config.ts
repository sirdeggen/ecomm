import { generateAccountXpub, type BsvNetwork } from "@ecomm/bsv-core";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

export interface ServerConfig {
  network: BsvNetwork;
  xpub: string;
  paymail?: string;
  ttlSeconds: number;
  port: number;
  publicUrl: string;
  webhookSecret: string;
  defaultWebhookUrl?: string;
  allowSimulated: boolean;
  dataDir: string;
  staticUsdRate?: number;
  arcUrl?: string;
  arcApiKey?: string;
  fxUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const network = (env.BSV_NETWORK || "testnet") as BsvNetwork;
  if (network !== "testnet" && network !== "mainnet") {
    throw new Error("BSV_NETWORK must be testnet or mainnet");
  }
  const dataDir = env.DATA_DIR || path.join(process.cwd(), "data");
  mkdirSync(dataDir, { recursive: true });
  const xpub = env.BSV_XPUB?.trim() || loadOrCreateXpub(dataDir, network);
  const ttlSeconds = Number(env.BSV_QUOTE_TTL_SECONDS || 900);
  const port = Number(env.PORT || env.PAYMENT_SERVER_PORT || 4000);
  const allowSimulated = (env.ALLOW_SIMULATED_PAYMENTS || "false").toLowerCase() === "true";
  const staticUsd = env.BSV_STATIC_USD_RATE ? Number(env.BSV_STATIC_USD_RATE) : undefined;
  const defaultArc = network === "testnet" ? "https://arc-test.taal.com" : "https://arc.taal.com";
  return {
    network,
    xpub,
    paymail: env.BSV_PAYMAIL?.trim() || undefined,
    ttlSeconds,
    port,
    publicUrl: (env.PAYMENT_SERVER_PUBLIC_URL || `http://127.0.0.1:${port}`).replace(/\/$/, ""),
    webhookSecret: env.WEBHOOK_SECRET || "dev-webhook-secret",
    defaultWebhookUrl: env.WEBHOOK_URL?.trim() || undefined,
    allowSimulated,
    dataDir,
    staticUsdRate: staticUsd && staticUsd > 0 ? staticUsd : undefined,
    arcUrl: env.ARC_URL?.trim() || defaultArc,
    arcApiKey: env.ARC_API_KEY?.trim() || undefined,
    fxUrl: env.FX_URL?.trim() || "https://api.frankfurter.app",
  };
}

function loadOrCreateXpub(dataDir: string, network: BsvNetwork): string {
  const file = path.join(dataDir, "merchant-key.json");
  if (existsSync(file)) {
    const saved = JSON.parse(readFileSync(file, "utf8")) as { xpub?: string };
    if (saved.xpub) return saved.xpub;
  }
  const generated = generateAccountXpub();
  writeFileSync(
    file,
    JSON.stringify(
      {
        network,
        xpub: generated.xpub,
        xpriv: generated.xpriv,
        note: "Generated for this local data directory. Testnet demo key. Do not commit this file.",
      },
      null,
      2,
    ),
  );
  return generated.xpub;
}
