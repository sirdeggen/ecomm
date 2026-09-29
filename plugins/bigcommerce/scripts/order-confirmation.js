/**
 * BigCommerce Script Manager snippet for the order confirmation page.
 * Paste into a script scoped to "Order confirmation", or load it from your app host.
 *
 * The shopper selected the offline method renamed to "Pay with BSV". This script
 * creates a BSV invoice for the order total and mounts the shared checkout panel.
 *
 * Order id discovery was not verified on a live store (no Technology Partner sandbox).
 * Set window.BSV_PAY before the script if your theme exposes the id elsewhere.
 */
(function () {
  var server = (window.BSV_PAY && window.BSV_PAY.serverUrl) || "";
  var orderId = (window.BSV_PAY && window.BSV_PAY.orderId) || readOrderId();
  var amount = (window.BSV_PAY && window.BSV_PAY.fiatAmount) || "";
  if (!server || !orderId || !amount) {
    console.warn("BSV Pay: set window.BSV_PAY = { serverUrl, orderId, fiatAmount }");
    return;
  }
  var root = document.getElementById("bsv-pay-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "bsv-pay-root";
    document.body.append(root);
  }
  fetch(server.replace(/\/$/, "") + "/v1/invoices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      orderRef: "bigcommerce-" + orderId,
      fiatAmount: amount,
      fiatCurrency: "USD",
      platform: "bigcommerce",
      metadata: { bigcommerceOrderId: orderId },
    }),
  })
    .then(function (response) { return response.json(); })
    .then(function (invoice) {
      var script = document.createElement("script");
      script.type = "module";
      script.textContent =
        "import { mount } from '" + server.replace(/\/$/, "") + "/checkout.js';" +
        "mount(document.getElementById('bsv-pay-root'), { serverUrl: '" + server + "', invoice: " + JSON.stringify(invoice) + " });";
      document.body.append(script);
    });

  function readOrderId() {
    var labeled = document.querySelector("[data-test='order-confirmation-order-number']");
    if (labeled && labeled.textContent) return labeled.textContent.replace(/\D/g, "");
    var match = window.location.pathname.match(/(\d{2,})/);
    return match ? match[1] : "";
  }
})();
