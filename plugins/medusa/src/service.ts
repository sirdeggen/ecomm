import { AbstractPaymentProvider } from "@medusajs/framework/utils";
import { authorizeBsvPayment, initiateBsvPayment, webhookAction, type BsvProviderOptions } from "./flow.js";

type PaymentData = { data?: Record<string, unknown> };

/**
 * Medusa v2 payment provider.
 * authorizePayment returns pending_authorization until the BSV invoice is paid, so checkout
 * can place the order in the awaiting-payment state (Medusa v2.17.2+).
 * https://docs.medusajs.com/resources/commerce-modules/payment/payment-flow
 */
class BsvPaymentProviderService extends AbstractPaymentProvider<BsvProviderOptions> {
  static identifier = "bsv-pay";

  static validateOptions(options: Record<string, unknown>): void {
    if (!options.serverUrl || typeof options.serverUrl !== "string") {
      throw new Error("bsv-pay requires options.serverUrl");
    }
  }

  constructor(container: Record<string, unknown>, options: BsvProviderOptions) {
    super(container, options);
  }

  async initiatePayment(input: Parameters<typeof initiateBsvPayment>[1]) {
    return initiateBsvPayment(this.config, input);
  }

  async authorizePayment(input: PaymentData) {
    return authorizeBsvPayment(this.config, input.data);
  }

  async capturePayment(input: PaymentData) {
    return { data: input.data ?? {} };
  }

  async cancelPayment(input: PaymentData) {
    return { data: input.data ?? {} };
  }

  async deletePayment(input: PaymentData) {
    return { data: input.data ?? {} };
  }

  async refundPayment(input: PaymentData) {
    return { data: input.data ?? {} };
  }

  async retrievePayment(input: PaymentData) {
    return authorizeBsvPayment(this.config, input.data);
  }

  async updatePayment(input: PaymentData) {
    return { data: input.data ?? {} };
  }

  async getPaymentStatus(input: PaymentData) {
    const result = await authorizeBsvPayment(this.config, input.data);
    return { status: result.status === "authorized" ? "authorized" : "pending", data: result.data };
  }

  async getWebhookActionAndData(payload: { data?: Record<string, unknown>; rawData?: unknown }) {
    return webhookAction(payload);
  }
}

export default BsvPaymentProviderService;
