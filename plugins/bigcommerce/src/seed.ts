import { HATS } from "@ecomm/catalog";

async function main() {
  const storeHash = required("BIGCOMMERCE_STORE_HASH");
  const accessToken = required("BIGCOMMERCE_ACCESS_TOKEN");
  for (const hat of HATS) {
    const response = await fetch(`https://api.bigcommerce.com/stores/${storeHash}/v3/catalog/products`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-auth-token": accessToken,
      },
      body: JSON.stringify({
        name: hat.name,
        type: "physical",
        price: Number(hat.price),
        weight: 0.2,
        description: `<p>${hat.detail}</p>`,
        is_visible: true,
        brand_name: "BSV Hats",
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      console.error(hat.name, body);
      continue;
    }
    console.log("created", body.data?.id, hat.name);
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
