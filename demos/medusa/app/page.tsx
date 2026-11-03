"use client";

import { HatsShop } from "@ecomm/storefront";

export default function Page() {
  return (
    <HatsShop
      platform="medusa"
      kicker="Medusa v2 · BSV testnet"
      note={
        <>
          <p>
            The Medusa provider returns <code>pending_authorization</code> from <code>authorizePayment</code> until the
            invoice is paid, which is the awaiting-payment path added in Medusa v2.17.2. This storefront places that
            order against the shared payment server. The provider module lives in <code>plugins/medusa</code>.
          </p>
          <p>
            A full Medusa backend also needs Postgres. <code>docker-compose.yml</code> in this demo starts it. Wiring
            the provider into <code>npx create-medusa-app</code> is in the plugin README.
          </p>
        </>
      }
    />
  );
}
