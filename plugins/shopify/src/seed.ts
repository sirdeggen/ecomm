import { HATS } from "@ecomm/catalog";
import { markShopifyOrderPaid } from "./index.js";

const CREATE = `mutation productCreate($product: ProductCreateInput!) {
  productCreate(product: $product) {
    product { id title }
    userErrors { field message }
  }
}`;

async function main() {
  const shop = required("SHOPIFY_SHOP");
  const accessToken = required("SHOPIFY_ADMIN_TOKEN");
  const version = process.env.SHOPIFY_API_VERSION || "2025-10";
  for (const hat of HATS) {
    const response = await fetch(`https://${shop}/admin/api/${version}/graphql.json`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-shopify-access-token": accessToken,
      },
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

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

if (process.argv[1]?.endsWith("seed.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { markShopifyOrderPaid };
