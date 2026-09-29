"use client";

import { cartTotal, HATS, hatById, type Hat } from "@ecomm/catalog";
import { mount } from "@ecomm/checkout-ui";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export interface CartLine {
  id: string;
  qty: number;
}

export interface InvoicePayload {
  invoiceId: string;
  orderRef: string;
  network: string;
  fiatAmount: string;
  fiatCurrency: string;
  satoshis: number;
  bsvAmount?: string;
  address: string;
  bip21: string;
  paymail?: string;
  expiresAt: string;
  lockingScriptHex: string;
  status: string;
  txid?: string;
  simulated?: boolean;
  satoshisReceived?: number;
}

type Platform = "stripe" | "medusa" | "shopify" | "bigcommerce";

const storageKey = (platform: Platform) => `bsv-hats-cart:${platform}`;

export function HatsShop(props: {
  platform: Platform;
  kicker: string;
  note: ReactNode;
  renderPayment?: (invoice: InvoicePayload) => ReactNode;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [view, setView] = useState<"shop" | "cart" | "checkout" | "pay">("shop");
  const [email, setEmail] = useState("");
  const [invoice, setInvoice] = useState<InvoicePayload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const raw = window.localStorage.getItem(storageKey(props.platform));
    if (raw) setLines(JSON.parse(raw) as CartLine[]);
  }, [props.platform]);

  useEffect(() => {
    window.localStorage.setItem(storageKey(props.platform), JSON.stringify(lines));
  }, [lines, props.platform]);

  const total = useMemo(() => cartTotal(lines), [lines]);
  const count = lines.reduce((sum, line) => sum + line.qty, 0);

  function add(hat: Hat) {
    setLines((current) => {
      const existing = current.find((line) => line.id === hat.id);
      if (existing) return current.map((line) => (line.id === hat.id ? { ...line, qty: line.qty + 1 } : line));
      return [...current, { id: hat.id, qty: 1 }];
    });
  }

  async function startPayment() {
    setBusy(true);
    setError("");
    try {
      const orderRef = `${props.platform}-${Date.now()}`;
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderRef,
          fiatAmount: total.fiatAmount,
          email,
          lines,
          platform: props.platform,
        }),
      });
      const body = (await response.json()) as InvoicePayload & { message?: string };
      if (!response.ok) throw new Error(body.message || "Could not create the invoice");
      setInvoice(body);
      setView("pay");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="shop-header">
        <div>
          <p className="platform-pill">{props.kicker}</p>
          <h1 className="wordmark">BSV <span>Hats</span></h1>
        </div>
        <button className="cart-link" type="button" onClick={() => setView(view === "shop" ? "cart" : "shop")}>
          {view === "shop" ? `Cart · ${count}` : "Back to hats"}
        </button>
      </header>
      <main className="shop-main">
        {view === "shop" && (
          <>
            <p className="lede">
              Six hats. One payment. The shopper pays from a BSV wallet on testnet, with a QR or paymail fallback. No account.
            </p>
            <div className="grid">
              {HATS.map((hat) => (
                <article className="hat-card" key={hat.id}>
                  <HatMark hat={hat} />
                  <h2>{hat.name}</h2>
                  <p>{hat.blurb}</p>
                  <p className="price">${hat.price}</p>
                  <button type="button" onClick={() => add(hat)}>Add to cart</button>
                </article>
              ))}
            </div>
          </>
        )}

        {view === "cart" && (
          <CartView
            lines={lines}
            total={total.fiatAmount}
            onQty={(id, qty) => setLines((current) => current.flatMap((line) => (line.id === id ? (qty > 0 ? [{ ...line, qty }] : []) : [line])))}
            onCheckout={() => setView("checkout")}
          />
        )}

        {view === "checkout" && (
          <section className="checkout">
            <div className="note">
              <h2 className="section-title">Checkout</h2>
              {props.note}
              <label className="field">
                Email for the receipt
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
              </label>
              <p className="price">Total ${total.fiatAmount}</p>
              {error && <p className="banner">{error}</p>}
              <button className="primary" type="button" disabled={busy || count === 0 || !email.includes("@")} onClick={startPayment}>
                {busy ? "Creating invoice…" : "Continue to BSV payment"}
              </button>
            </div>
            <CartView lines={lines} total={total.fiatAmount} compact />
          </section>
        )}

        {view === "pay" && invoice && (
          <section className="checkout">
            <div>
              {props.renderPayment ? props.renderPayment(invoice) : <PaymentPanel invoice={invoice} />}
            </div>
            <div className="note">
              <h2 className="section-title">Order {invoice.orderRef}</h2>
              <p>${invoice.fiatAmount} locked until {new Date(invoice.expiresAt).toLocaleTimeString()}.</p>
              <p>Receipt email: {email}</p>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

function CartView(props: {
  lines: CartLine[];
  total: string;
  compact?: boolean;
  onQty?: (id: string, qty: number) => void;
  onCheckout?: () => void;
}) {
  if (props.lines.length === 0) return <p>Your cart is empty.</p>;
  return (
    <div>
      <table className="cart-table">
        <tbody>
          {props.lines.map((line) => {
            const hat = hatById(line.id);
            if (!hat) return null;
            return (
              <tr key={line.id}>
                <td>{hat.name}</td>
                <td>
                  {props.onQty ? (
                    <span className="qty">
                      <button className="ghost" type="button" onClick={() => props.onQty?.(line.id, line.qty - 1)}>-</button>
                      {line.qty}
                      <button className="ghost" type="button" onClick={() => props.onQty?.(line.id, line.qty + 1)}>+</button>
                    </span>
                  ) : (
                    line.qty
                  )}
                </td>
                <td>${hat.price}</td>
              </tr>
            );
          })}
          <tr>
            <th colSpan={2}>Total</th>
            <th>${props.total}</th>
          </tr>
        </tbody>
      </table>
      {props.onCheckout && (
        <p>
          <button className="primary" type="button" onClick={props.onCheckout}>Checkout</button>
        </p>
      )}
    </div>
  );
}

export function PaymentPanel({ invoice }: { invoice: InvoicePayload }) {
  const ref = useRef<HTMLDivElement>(null);
  const serverUrl = process.env.NEXT_PUBLIC_PAYMENT_SERVER_URL || "http://127.0.0.1:4000";
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = mount(el, { serverUrl, invoice });
    return () => {
      if (typeof stop === "function") stop();
    };
  }, [invoice, serverUrl]);
  return <div ref={ref} />;
}

function HatMark({ hat }: { hat: Hat }) {
  return (
    <svg viewBox="0 0 240 140" width="100%" height="120" role="img" aria-label={hat.name}>
      <rect width="240" height="140" rx="16" fill="#f6f1e7" />
      <ellipse cx="120" cy="108" rx="78" ry="14" fill={hat.brim} />
      <path d="M70 92c6-38 28-58 50-58s44 20 50 58" fill={hat.accent} />
      <path d="M78 78c10-8 22-12 42-12s32 4 42 12" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="4" />
      <circle cx="168" cy="70" r="4" fill="#f4efe4" />
    </svg>
  );
}
