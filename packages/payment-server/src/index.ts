import { HttpChainReader } from "@ecomm/bsv-core";
import { loadConfig } from "./config.js";
import { createHttpServer } from "./http.js";
import { PaymentService } from "./service.js";
import { InvoiceStore } from "./store.js";
import { createChainReader } from "./toolboxChain.js";

export { loadConfig } from "./config.js";
export { createHttpServer } from "./http.js";
export { PaymentService } from "./service.js";
export { InvoiceStore } from "./store.js";
export { signBody, signaturesMatch } from "./webhook.js";
export { createChainReader } from "./toolboxChain.js";

export async function startServer(env: NodeJS.ProcessEnv = process.env) {
  const config = loadConfig(env);
  const store = new InvoiceStore(config.dataDir);
  const chain = config.staticUsdRate
    ? {
        reader: new HttpChainReader({
          network: config.network,
          arcUrl: config.arcUrl,
          arcApiKey: config.arcApiKey,
          fetchImpl: async () => {
            throw new Error("static rate tests should not call the network");
          },
        }),
        backend: "http" as const,
      }
    : await createChainReader({
        network: config.network,
        arcUrl: config.arcUrl,
        arcApiKey: config.arcApiKey,
      });
  const service = new PaymentService(config, store, chain.reader);
  const server = createHttpServer(config, service);
  await new Promise<void>((resolve) => server.listen(config.port, "0.0.0.0", resolve));
  console.log(`BSV payment server listening on ${config.publicUrl} (${config.network}, chain=${chain.backend}, simulated=${config.allowSimulated})`);
  return { server, config, service, backend: chain.backend };
}

