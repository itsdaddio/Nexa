import { serve } from "@hono/node-server";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.js";
import { createLeadStore } from "./db.js";

const port = Number(process.env.PORT ?? 3000);

const store = await createLeadStore();
const app = createApp({ store });

serve({ fetch: app.fetch, port }, (info: AddressInfo) => {
  console.log(`Nexa listening on http://localhost:${info.port}`);
});
