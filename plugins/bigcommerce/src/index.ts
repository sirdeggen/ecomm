export interface BigCommerceAdmin {
  storeHash: string;
  accessToken: string;
  /** Default 11, BigCommerce's stock "Awaiting Fulfillment" status. Confirm with GET /v2/order_statuses. */
  paidStatusId?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Move an offline-payment order forward after the BSV payment is seen.
 * https://docs.bigcommerce.com/developer/docs/admin/checkout-and-cart/orders/overview
 */
export async function markBigCommerceOrderPaid(admin: BigCommerceAdmin, orderId: number) {
  const statusId = admin.paidStatusId ?? Number(process.env.BIGCOMMERCE_PAID_STATUS_ID || 11);
  const fetchImpl = admin.fetchImpl ?? fetch;
  const response = await fetchImpl(`https://api.bigcommerce.com/stores/${admin.storeHash}/v2/orders/${orderId}`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      "x-auth-token": admin.accessToken,
    },
    body: JSON.stringify({ status_id: statusId }),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`BigCommerce HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? (JSON.parse(text) as { id: number; status_id: number }) : { id: orderId, status_id: statusId };
}
