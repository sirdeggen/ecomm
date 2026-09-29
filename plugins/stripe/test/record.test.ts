import assert from "node:assert/strict";
import { test } from "node:test";
import { customPaymentMethodElement, paymentRecordParams } from "../src/index.js";

test("builds a Payment Record for an off-Stripe BSV payment", () => {
  const params = paymentRecordParams(
    {
      amountCents: 2400,
      currency: "USD",
      customPaymentMethodType: "cpmt_test_bsv",
      paymentReference: "inv_abc",
    },
    "pm_123",
    1_700_000_000,
  );
  assert.equal(params.amount_requested.value, 2400);
  assert.equal(params.amount_requested.currency, "usd");
  assert.equal(params.payment_method_details.payment_method, "pm_123");
  assert.equal(params.processor_details.custom.payment_reference, "inv_abc");
  assert.equal(params.outcome, "guaranteed");
  assert.equal(params.customer_presence, "on_session");
});

test("places Pay with BSV in the Payment Element custom method list", () => {
  const options = customPaymentMethodElement("cpmt_test_bsv");
  assert.equal(options.customPaymentMethods[0]?.id, "cpmt_test_bsv");
  assert.equal(options.customPaymentMethods[0]?.payment.type, "static");
  assert.match(options.customPaymentMethods[0]?.payment.subtitle ?? "", /BSV/);
});
