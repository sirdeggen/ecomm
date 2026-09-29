import { reactExtension, BlockStack, Text, useApi, useSettings } from "@shopify/ui-extensions-react/checkout";

export default reactExtension("purchase.thank-you.block.render", () => <PayWithBsv />);

function PayWithBsv() {
  const settings = useSettings();
  const api = useApi();
  const orderId = api.orderConfirmation?.current?.order?.id || api.orderConfirmation?.current?.number;
  const server = String(settings.server_url || "");
  return (
    <BlockStack spacing="tight">
      <Text emphasis="bold">Pay with BSV</Text>
      <Text>
        Order {orderId || "pending"}. The payment panel is served by {server || "the BSV payment server configured on the app"}.
        This extension cannot mark the order paid itself. It asks the payment server, which calls orderMarkAsPaid after the tx is seen.
      </Text>
    </BlockStack>
  );
}
