import { BsvPayError, satoshisToBsvString } from "@ecomm/bsv-core";
import { existsSync, readFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import QRCode from "qrcode";
import type { ServerConfig } from "./config.js";
import type { PaymentService } from "./service.js";

export function createHttpServer(config: ServerConfig, service: PaymentService) {
  return createServer(async (req, res) => {
    try {
      applyCors(req, res);
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
      }
      const url = new URL(req.url || "/", config.publicUrl);
      if (req.method === "GET" && url.pathname === "/health") {
        return send(res, 200, { ok: true, network: config.network });
      }
      if (req.method === "GET" && url.pathname === "/checkout.js") {
        const file = checkoutBundlePath();
        if (!file) {
          send(res, 404, { error: "checkout_bundle_missing" });
          return;
        }
        res.writeHead(200, {
          "content-type": "text/javascript; charset=utf-8",
          "access-control-allow-origin": "*",
        });
        res.end(readFileSync(file));
        return;
      }
      if (req.method === "GET" && url.pathname === "/v1/public-config") {
        return send(res, 200, {
          network: config.network,
          simulatedAllowed: config.allowSimulated,
          paymail: config.paymail ?? null,
          publicUrl: config.publicUrl,
        });
      }
      if (req.method === "POST" && url.pathname === "/v1/invoices") {
        const body = await readJson(req);
        const invoice = await service.createInvoice({
          orderRef: String(body.orderRef ?? ""),
          fiatAmount: String(body.fiatAmount ?? ""),
          fiatCurrency: body.fiatCurrency ? String(body.fiatCurrency) : undefined,
          platform: body.platform ? String(body.platform) : undefined,
          webhookUrl: body.webhookUrl ? String(body.webhookUrl) : undefined,
          metadata: isRecord(body.metadata) ? body.metadata : undefined,
        });
        return send(res, 201, present(invoice));
      }
      const invoiceMatch = url.pathname.match(/^\/v1\/invoices\/([^/]+)(?:\/(submit|simulate|poll|qr\.svg))?$/);
      if (invoiceMatch) {
        const id = decodeURIComponent(invoiceMatch[1]!);
        const action = invoiceMatch[2];
        if (req.method === "GET" && !action) return send(res, 200, present(service.getInvoice(id)));
        if (req.method === "GET" && action === "qr.svg") {
          const invoice = service.getInvoice(id);
          const svg = await QRCode.toString(invoice.bip21, { type: "svg", margin: 1, width: 280 });
          res.writeHead(200, { "content-type": "image/svg+xml; charset=utf-8", "access-control-allow-origin": "*" });
          res.end(svg);
          return;
        }
        if (req.method === "POST" && action === "poll") return send(res, 200, present(await service.poll(id)));
        if (req.method === "POST" && action === "submit") {
          const body = await readJson(req);
          return send(res, 200, present(await service.submitTxid(id, String(body.txid ?? ""))));
        }
        if (req.method === "POST" && action === "simulate") {
          return send(res, 200, present(await service.simulate(id, req.socket.remoteAddress)));
        }
      }
      send(res, 404, { error: "not_found" });
    } catch (error) {
      if (error instanceof BsvPayError) {
        const status = error.code === "not_found" ? 404 : error.code === "simulate_disabled" || error.code === "simulate_remote" ? 403 : 400;
        send(res, status, { error: error.code, message: error.message });
        return;
      }
      console.error(error);
      send(res, 500, { error: "internal", message: (error as Error).message });
    }
  });
}

function present(invoice: ReturnType<PaymentService["getInvoice"]>) {
  return {
    ...invoice,
    bsvAmount: satoshisToBsvString(invoice.satoshis),
  };
}

function applyCors(req: IncomingMessage, res: ServerResponse): void {
  const origin = req.headers.origin;
  res.setHeader("access-control-allow-origin", typeof origin === "string" ? origin : "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,authorization,x-bsv-signature");
  res.setHeader("vary", "origin");
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": res.getHeader("access-control-allow-origin") || "*" });
  res.end(payload);
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > 64_000) throw new BsvPayError("Request body is too large", "too_large");
    chunks.push(buf);
  }
  if (chunks.length === 0) return {};
  const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  if (!isRecord(parsed)) throw new BsvPayError("JSON body must be an object", "bad_json");
  return parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function checkoutBundlePath(): string | undefined {
  const candidates = [
    process.env.CHECKOUT_BUNDLE,
    new URL("../../checkout-ui/dist/checkout.js", import.meta.url),
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const file = candidate instanceof URL ? candidate : new URL(candidate, "file://");
    const pathname = candidate instanceof URL ? file.pathname : String(candidate);
    if (existsSync(pathname)) return pathname;
  }
  return undefined;
}
