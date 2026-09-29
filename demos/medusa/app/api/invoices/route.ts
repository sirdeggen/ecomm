import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const server = process.env.PAYMENT_SERVER_URL || "http://127.0.0.1:4000";
  const response = await fetch(`${server}/v1/invoices`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderRef: body.orderRef,
      fiatAmount: body.fiatAmount,
      fiatCurrency: "USD",
      platform: "medusa",
      metadata: { email: body.email, lines: body.lines, session_id: body.orderRef },
    }),
  });
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}
