import { createHmac, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";
import { markBigCommerceOrderPaid } from "./index.js";

const secret = process.env.WEBHOOK_SECRET || "";
const port = Number(process.env.BIGCOMMERCE_RECEIVER_PORT || 4101);

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
  if (header.length !== expected.length || !timingSafeEqual(Buffer.from(header), Buffer.from(expected))) {
    res.writeHead(401);
    res.end("invalid signature");
    return;
  }
  const event = JSON.parse(body) as { type?: string; metadata?: { bigcommerceOrderId?: number | string } };
  const orderId = Number(event.metadata?.bigcommerceOrderId);
  if (event.type !== "invoice.paid" || !orderId) {
    res.writeHead(200);
    res.end("ignored");
    return;
  }
  if (!process.env.BIGCOMMERCE_STORE_HASH || !process.env.BIGCOMMERCE_ACCESS_TOKEN) {
    res.writeHead(501);
    res.end("store credentials missing");
    return;
  }
  await markBigCommerceOrderPaid(
    { storeHash: process.env.BIGCOMMERCE_STORE_HASH, accessToken: process.env.BIGCOMMERCE_ACCESS_TOKEN },
    orderId,
  );
  res.writeHead(200);
  res.end("ok");
}).listen(port, () => {
  console.log(`BigCommerce paid-webhook receiver on :${port}`);
});
