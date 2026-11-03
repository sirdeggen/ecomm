import { normalizeShop, shopifyAuthorizedFetch } from "./token.js";

export interface ShopifyAdmin {
  shop: string;
  accessToken: string;
  apiVersion?: string;
  fetchImpl?: typeof fetch;
  /**
   * Called after Shopify answers 401. The mutation is retried once with the returned token.
   * Leave unset for a static token.
   */
  refreshAccessToken?: () => Promise<string>;
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
  const shop = normalizeShop(admin.shop);
  const fetchImpl = admin.fetchImpl ?? fetch;
  const response = await shopifyAuthorizedFetch(
    fetchImpl,
    `https://${shop}/admin/api/${version}/graphql.json`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: MARK_PAID, variables: { input: { id: orderGid } } }),
    },
    admin.accessToken,
    admin.refreshAccessToken,
  );
  const text = await response.text();
  let body: {
    errors?: Array<{ message: string }>;
    data?: { orderMarkAsPaid?: { userErrors: Array<{ message: string }>; order?: { id: string; displayFinancialStatus: string } } };
  } = {};
  if (text) {
    try {
      body = JSON.parse(text) as typeof body;
    } catch {
      if (!response.ok) throw new Error(`Shopify HTTP ${response.status}: ${text.slice(0, 300)}`);
      throw new Error("Shopify response was not JSON");
    }
  }
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

export {
  createShopifySession,
  normalizeShop,
  SHOPIFY_TOKEN_REFRESH_SKEW_MS,
  ShopifyCredentialsError,
  shopifyAuthorizedFetch,
  shopifySessionFromEnv,
} from "./token.js";
export type { ShopifySession, ShopifySessionOptions } from "./token.js";
