/**
 * Shopper payment panel: one-click WalletClient, plus QR / BIP21 / paymail fallbacks.
 * The real testnet path is the default. The simulated toggle is explicit and off until checked.
 */

export function mount(root, options) {
  const serverUrl = options.serverUrl.replace(/\/$/, "");
  const invoice = options.invoice;
  root.innerHTML = "";
  root.classList.add("bsv-pay");
  const panel = document.createElement("section");
  panel.className = "bsv-pay__panel";
  panel.innerHTML = `
    <header class="bsv-pay__head">
      <p class="bsv-pay__kicker">Pay with BSV · ${escapeHtml(invoice.network)}</p>
      <h2>${escapeHtml(invoice.fiatAmount)} ${escapeHtml(invoice.fiatCurrency)}</h2>
      <p class="bsv-pay__bsv"><span data-bsv>${escapeHtml(invoice.bsvAmount || "")}</span> BSV <span data-sats></span></p>
      <p class="bsv-pay__expiry">Quote expires <time data-expiry></time></p>
    </header>
    <button type="button" class="bsv-pay__wallet" data-wallet>Pay with BSV wallet</button>
    <p class="bsv-pay__hint">Uses a BRC-100 wallet such as BSV Desktop. No shopper account.</p>
    <div class="bsv-pay__fallback">
      <h3>QR, address, or paymail</h3>
      <img data-qr alt="BIP21 payment QR" width="220" height="220" />
      <p><a data-bip21 href="">Open in a wallet</a></p>
      <label class="bsv-pay__addr">Address <input data-address readonly /></label>
      <p data-paymail class="bsv-pay__paymail" hidden></p>
      <button type="button" class="bsv-pay__copy" data-copy>Copy payment link</button>
    </div>
    <label class="bsv-pay__sim">
      <input type="checkbox" data-sim />
      Simulated payment (dev only). This does not broadcast a testnet transaction.
    </label>
    <p class="bsv-pay__status" data-status role="status">Waiting for a testnet payment.</p>
  `;
  root.append(panel);

  const statusEl = panel.querySelector("[data-status]");
  const sim = panel.querySelector("[data-sim]");
  const walletBtn = panel.querySelector("[data-wallet]");
  panel.querySelector("[data-sats]").textContent = `(${invoice.satoshis.toLocaleString()} satoshis)`;
  panel.querySelector("[data-expiry]").textContent = new Date(invoice.expiresAt).toLocaleString();
  panel.querySelector("[data-qr]").src = `${serverUrl}/v1/invoices/${encodeURIComponent(invoice.invoiceId)}/qr.svg`;
  const bip21 = panel.querySelector("[data-bip21]");
  bip21.href = invoice.bip21;
  bip21.textContent = "BIP21 payment link";
  panel.querySelector("[data-address]").value = invoice.address;
  if (invoice.paymail) {
    const paymail = panel.querySelector("[data-paymail]");
    paymail.hidden = false;
    paymail.textContent = `Paymail fallback: ${invoice.paymail}. Automatic detection still watches the unique address above.`;
  }
  panel.querySelector("[data-copy]").addEventListener("click", async () => {
    await navigator.clipboard.writeText(invoice.bip21);
    setStatus(statusEl, "Payment link copied.");
  });

  let simulatedAllowed = false;
  fetch(`${serverUrl}/v1/public-config`)
    .then((response) => response.json())
    .then((config) => {
      simulatedAllowed = Boolean(config.simulatedAllowed);
      sim.disabled = !simulatedAllowed;
      if (!simulatedAllowed) {
        sim.parentElement.title = "The payment server has ALLOW_SIMULATED_PAYMENTS=false.";
      }
    })
    .catch(() => {
      sim.disabled = true;
    });

  walletBtn.addEventListener("click", async () => {
    walletBtn.disabled = true;
    setStatus(statusEl, "Opening the wallet…");
    try {
      const txid = await payWithWallet(invoice);
      setStatus(statusEl, `Broadcast ${txid}. Checking the payment…`);
      const submitted = await postJson(`${serverUrl}/v1/invoices/${invoice.invoiceId}/submit`, { txid });
      renderState(statusEl, walletBtn, submitted);
    } catch (error) {
      setStatus(statusEl, error.message || "The wallet payment did not finish.");
      walletBtn.disabled = false;
    }
  });

  sim.addEventListener("change", async () => {
    if (!sim.checked) return;
    if (!simulatedAllowed) {
      sim.checked = false;
      setStatus(statusEl, "Simulated payments are turned off on this server.");
      return;
    }
    const ok = window.confirm("Mark this order paid without a testnet transaction? Use this only for development.");
    if (!ok) {
      sim.checked = false;
      return;
    }
    try {
      const body = await postJson(`${serverUrl}/v1/invoices/${invoice.invoiceId}/simulate`, {});
      renderState(statusEl, walletBtn, body);
    } catch (error) {
      sim.checked = false;
      setStatus(statusEl, error.message || "Simulated payment failed.");
    }
  });

  const timer = window.setInterval(async () => {
    try {
      const body = await postJson(`${serverUrl}/v1/invoices/${invoice.invoiceId}/poll`, {});
      if (body.status === "paid" || body.status === "expired") {
        window.clearInterval(timer);
        renderState(statusEl, walletBtn, body);
        if (body.status === "paid" && typeof options.onPaid === "function") options.onPaid(body);
      } else if (body.status === "underpaid") {
        setStatus(statusEl, `Underpaid. Received ${body.satoshisReceived} of ${body.satoshis} satoshis.`);
      }
    } catch {
      // Keep the last status. The next poll will retry.
    }
  }, 4000);

  return () => window.clearInterval(timer);
}

async function payWithWallet(invoice) {
  const { WalletClient } = await import("@bsv/sdk");
  const originator = window.location.hostname || "localhost";
  const wallet = new WalletClient("auto", originator);
  const result = await wallet.createAction({
    description: `Pay ${invoice.orderRef}`.slice(0, 50),
    outputs: [
      {
        lockingScript: invoice.lockingScriptHex,
        satoshis: invoice.satoshis,
        outputDescription: "Order payment",
      },
    ],
  });
  if (!result?.txid) throw new Error("The wallet did not return a transaction id. You can still pay the QR.");
  return result.txid;
}

function renderState(statusEl, walletBtn, invoice) {
  if (invoice.status === "paid") {
    const mode = invoice.simulated ? "Simulated payment recorded" : "Payment seen on testnet";
    setStatus(statusEl, `${mode}. txid ${invoice.txid}`);
    walletBtn.disabled = true;
    return;
  }
  if (invoice.status === "expired") {
    setStatus(statusEl, "This quote expired. Start checkout again for a new address.");
    walletBtn.disabled = true;
  }
}

function setStatus(el, text) {
  el.textContent = text;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || payload.error || `HTTP ${response.status}`);
  return payload;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
