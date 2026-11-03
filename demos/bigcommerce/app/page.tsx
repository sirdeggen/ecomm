"use client";

import { HatsShop } from "@ecomm/storefront";

export default function Page() {
  return (
    <HatsShop
      platform="bigcommerce"
      kicker="BigCommerce offline method · BSV testnet"
      note={
        <>
          <p>
            BigCommerce has no custom card gateway here. Rename an offline method (Bank Deposit, Check, or Money Order)
            to Pay with BSV, then the order-confirmation script mounts this panel. The backend sets the order status
            when the invoice is paid.
          </p>
          <p>
            A sandbox store needs a Technology Partner account, which is not set up. The Open Payment Provider fee is
            described in the root README from BigCommerce&apos;s own pricing pages and has not been checked against a live invoice.
          </p>
        </>
      }
    />
  );
}
