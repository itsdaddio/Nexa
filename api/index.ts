import { createApp } from "../src/app.js";
import { InMemoryLeadStore } from "../src/db.js";

const app = createApp({ store: new InMemoryLeadStore() });

export default {
  fetch(request: Request) {
    return app.fetch(request);
  },
};
