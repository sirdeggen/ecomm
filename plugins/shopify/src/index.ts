export interface ShopifyAdmin {
  shop: string;
  accessToken: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}

const MARK_PAID = `mutation orderMarkAsPaid($input: OrderMarkAsPaidInput!) {
  orderMarkAsPaid(input: $input) {
    userErrors { field message }
    order { id displayFinancialStatus }
  }
}`;

/**
 * Record an off-platform BSV payment on a manual-payment order.
 * Requires the write_orders scope and the mark_orders_as_paid permission.
 * https://shopify.dev/docs/api/admin-graphql/latest/mutations/orderMarkAsPaid
 */
export async function markShopifyOrderPaid(admin: ShopifyAdmin, orderGid: string) {
  const version = admin.apiVersion || process.env.SHOPIFY_API_VERSION || "2025-10";
  const shop = admin.shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const fetchImpl = admin.fetchImpl ?? fetch;
  const response = await fetchImpl(`https://${shop}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shopify-access-token": admin.accessToken,
    },
    body: JSON.stringify({ query: MARK_PAID, variables: { input: { id: orderGid } } }),
  });
  const body = (await response.json()) as {
    errors?: Array<{ message: string }>;
    data?: { orderMarkAsPaid?: { userErrors: Array<{ message: string }>; order?: { id: string; displayFinancialStatus: string } } };
  };
  if (!response.ok || body.errors?.length) {
    throw new Error(body.errors?.map((error) => error.message).join("; ") || `Shopify HTTP ${response.status}`);
  }
  const payload = body.data?.orderMarkAsPaid;
  if (payload?.userErrors?.length) {
    throw new Error(payload.userErrors.map((error) => error.message).join("; "));
  }
  return payload?.order;
}

export function orderGid(id: string | number): string {
  const value = String(id);
  return value.startsWith("gid://") ? value : `gid://shopify/Order/${value}`;
}
