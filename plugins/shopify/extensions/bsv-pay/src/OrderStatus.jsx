import { reactExtension, BlockStack, Text, useApi, useSettings } from "@shopify/ui-extensions-react/customer-account";

export default reactExtension("customer-account.order-status.block.render", () => <PayWithBsv />);

function PayWithBsv() {
  const settings = useSettings();
  const api = useApi();
  const orderId = api.order?.current?.id;
  return (
    <BlockStack spacing="tight">
      <Text emphasis="bold">Pay with BSV</Text>
      <Text>
        Order {orderId || ""}. Payment server: {String(settings.server_url || "(set the server_url extension setting)")}.
      </Text>
    </BlockStack>
  );
}
