import { HATS } from "@ecomm/catalog";
import { markShopifyOrderPaid } from "./index.js";
import { shopifySessionFromEnv } from "./token.js";

const CREATE = `mutation productCreate($product: ProductCreateInput!) {
  productCreate(product: $product) {
    product { id title }
    userErrors { field message }
  }
}`;

async function main() {
  const session = shopifySessionFromEnv();
  const version = session.apiVersion || "2025-10";
  for (const hat of HATS) {
    const response = await session.authorizedFetch(`https://${session.shop}/admin/api/${version}/graphql.json`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        query: CREATE,
        variables: {
          product: {
            title: hat.name,
            descriptionHtml: `<p>${hat.detail}</p>`,
            status: "ACTIVE",
            productType: "Hat",
            vendor: "BSV Hats",
          },
        },
      }),
    });
    const body = await response.json();
    console.log(hat.name, JSON.stringify(body.data?.productCreate?.product ?? body));
  }
}

if (process.argv[1]?.endsWith("seed.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { markShopifyOrderPaid };
