"use client";

import { HatsShop } from "@ecomm/storefront";

export default function Page() {
  return (
    <HatsShop
      platform="shopify"
      kicker="Shopify manual payment · BSV testnet"
      note={
        <>
          <p>
            This page is the thank-you / order-status payment the checkout UI extension shows after the shopper picks
            the manual method named Pay with BSV. One custom app is installed per store. A Partner account is required
            before the extension can be deployed, and those credentials are not in this environment.
          </p>
          <p>Run <code>npm run seed -w @ecomm/demo-shopify</code> after <code>SHOPIFY_SHOP</code> and <code>SHOPIFY_ADMIN_TOKEN</code> exist.</p>
        </>
      }
    />
  );
}
