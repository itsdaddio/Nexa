import { handle } from "hono/vercel";
import { createApp } from "../src/app.js";
import { InMemoryLeadStore } from "../src/db.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const app = createApp({ store: new InMemoryLeadStore() });

export default handle(app);
