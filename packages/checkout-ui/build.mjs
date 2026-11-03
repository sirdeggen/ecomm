import esbuild from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

await esbuild.build({
  entryPoints: ["src/checkout.js"],
  bundle: true,
  format: "esm",
  outfile: "dist/checkout.js",
  platform: "browser",
  target: "es2022",
  legalComments: "none",
});

mkdirSync("../../plugins/woocommerce/bsv-pay/assets", { recursive: true });
copyFileSync("dist/checkout.js", "../../plugins/woocommerce/bsv-pay/assets/checkout.js");
console.log("wrote dist/checkout.js and the WooCommerce plugin asset");
