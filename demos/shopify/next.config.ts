import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ecomm/storefront", "@ecomm/catalog", "@ecomm/checkout-ui", "@ecomm/plugin-shopify"],
};

export default nextConfig;
