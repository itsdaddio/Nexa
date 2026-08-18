import test from "node:test";
import assert from "node:assert/strict";
import { createApp, leadIds } from "../src/app.js";
import { InMemoryLeadStore } from "../src/db.js";
import { scoreLead } from "../src/scoring.js";

test("scoreLead applies v1 scoring weights", () => {
  const score = scoreLead({ source: "agency", phone: "5551234", company: "Nexa" });
  assert.equal(score, 50);
});

test("lead create stores scored new unworked lead", async () => {
  const store = new InMemoryLeadStore();
  const app = createApp({ store });

  const res = await app.request("http://localhost/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: "Ada Lovelace",
      email: "ada@example.com",
      source: "utm",
      phone: "555-1212",
      company: "Analytical Engines",
      workspaceId: "ws-1",
    }),
  });

  assert.equal(res.status, 201);
  const payload = (await res.json()) as { lead: { status: string; worked: boolean; score: number } };

  assert.equal(payload.lead.status, "new");
  assert.equal(payload.lead.worked, false);
  assert.equal(payload.lead.score, 53);
});

test("today endpoint returns max five and always includes newest unworked", async () => {
  const store = new InMemoryLeadStore();
  const app = createApp({ store });

  const base = [
    { name: "L1", email: "l1@example.com", source: "agency", phone: "1", company: "A" },
    { name: "L2", email: "l2@example.com", source: "agency", phone: "1", company: "A" },
    { name: "L3", email: "l3@example.com", source: "agency", phone: "1", company: "A" },
    { name: "L4", email: "l4@example.com", source: "agency", phone: "1", company: "A" },
    { name: "L5", email: "l5@example.com", source: "agency", phone: "1", company: "A" },
    { name: "L6", email: "l6@example.com", source: "direct" },
  ];

  for (const row of base) {
    await app.request("http://localhost/api/leads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...row, workspaceId: "ws-today" }),
    });
  }

  const all = await app.request("http://localhost/api/leads?workspaceId=ws-today");
  const allPayload = (await all.json()) as { leads: Array<{ id: string }> };
  const newestLeadId = allPayload.leads[0].id;

  const today = await app.request("http://localhost/api/today?workspaceId=ws-today");
  const todayPayload = (await today.json()) as { leads: Array<{ id: string }> };

  assert.equal(todayPayload.leads.length, 5);
  assert.ok(leadIds(todayPayload.leads as never).includes(newestLeadId));
});

test("hubspot push failures do not block capture", async () => {
  const store = new InMemoryLeadStore();
  const app = createApp({
    store,
    pushLead: async () => {
      throw new Error("boom");
    },
  });

  const res = await app.request("http://localhost/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "Grace", email: "grace@example.com", source: "direct" }),
  });

  assert.equal(res.status, 201);
});
