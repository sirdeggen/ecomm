/**
 * Drop-in fragment for medusa-config.ts. Not executed on its own.
 *
 * modules: [
 *   {
 *     resolve: "@medusajs/medusa/payment",
 *     options: {
 *       providers: [
 *         {
 *           resolve: "@ecomm/plugin-medusa",
 *           id: "bsv",
 *           options: {
 *             serverUrl: process.env.BSV_PAY_SERVER_URL,
 *           },
 *         },
 *       ],
 *     },
 *   },
 * ]
 */
export {};
