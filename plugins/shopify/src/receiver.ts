import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { markShopifyOrderPaid, orderGid } from "./index.js";

const secret = process.env.WEBHOOK_SECRET || "";
const port = Number(process.env.SHOPIFY_RECEIVER_PORT || 4100);

createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(404);
    res.end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = Buffer.concat(chunks).toString("utf8");
  const header = String(req.headers["x-bsv-signature"] || "");
  const expected = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  const valid = header.length === expected.length && timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  if (!valid) {
    res.writeHead(401);
    res.end("invalid signature");
    return;
  }
  const event = JSON.parse(body) as { type?: string; metadata?: { shopifyOrderId?: string } };
  const orderId = event.metadata?.shopifyOrderId;
  if (event.type !== "invoice.paid" || !orderId) {
    res.writeHead(200);
    res.end("ignored");
    return;
  }
  if (!process.env.SHOPIFY_SHOP || !process.env.SHOPIFY_ADMIN_TOKEN) {
    res.writeHead(501);
    res.end("shop credentials missing");
    return;
  }
  await markShopifyOrderPaid(
    { shop: process.env.SHOPIFY_SHOP, accessToken: process.env.SHOPIFY_ADMIN_TOKEN },
    orderGid(orderId),
  );
  res.writeHead(200);
  res.end("ok");
}).listen(port, () => {
  console.log(`Shopify paid-webhook receiver on :${port}`);
});
