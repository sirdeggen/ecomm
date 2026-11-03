import { ModuleProvider, Modules } from "@medusajs/framework/utils";
import BsvPaymentProviderService from "./service.js";

export default ModuleProvider(Modules.PAYMENT, {
  services: [BsvPaymentProviderService],
});

export { default as BsvPaymentProviderService } from "./service.js";
export { authorizeBsvPayment, initiateBsvPayment, webhookAction } from "./flow.js";
