import { handle } from "hono/vercel";
import { createApp } from "../src/app.js";
import { createLeadStore } from "../src/db.js";

const store = await createLeadStore();
const app = createApp({ store });

export default handle(app);
