import { Hono } from "hono";
import { html } from "hono/html";
import type { Lead } from "./types.js";
import { scoreLead } from "./scoring.js";
import { pushLeadToHubSpot } from "./hubspot.js";
import { priorityLeads } from "./priority.js";
import { InMemoryLeadStore, type LeadStore } from "./db.js";
import type { LeadSource } from "./types.js";

const VALID_SOURCES = new Set<LeadSource>(["direct", "utm", "referral", "agency", "content"]);

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export interface AppDependencies {
  store?: LeadStore;
  hubspotToken?: string;
  pushLead?: typeof pushLeadToHubSpot;
}

export function createApp(deps: AppDependencies = {}): Hono {
  const app = new Hono();
  const store = deps.store ?? new InMemoryLeadStore();
  const pushLead = deps.pushLead ?? pushLeadToHubSpot;

  app.get("/", (c) => c.redirect("/capture"));

  app.get("/capture", (c) =>
    c.html(
      html`<!doctype html>
        <html>
          <body>
            <h1>Nexa Capture</h1>
            <form method="post" action="/api/leads">
              <label>Name <input name="name" required /></label><br />
              <label>Email <input name="email" type="email" required /></label><br />
              <label>Phone <input name="phone" /></label><br />
              <label>Company <input name="company" /></label><br />
              <label>Message <textarea name="message"></textarea></label><br />
              <label>Source
                <select name="source">
                  <option value="direct">direct</option>
                  <option value="utm">utm</option>
                  <option value="referral">referral</option>
                  <option value="agency">agency</option>
                  <option value="content">content</option>
                </select>
              </label><br />
              <input type="hidden" name="workspaceId" value="default" />
              <button type="submit">Submit</button>
            </form>
          </body>
        </html>`,
    ),
  );

  app.post("/api/leads", async (c) => {
    const contentType = c.req.header("content-type") ?? "";

    const payload = contentType.includes("application/json")
      ? ((await c.req.json()) as Record<string, unknown>)
      : ((await c.req.parseBody()) as Record<string, unknown>);

    const name = normalizeText(payload.name);
    const email = normalizeText(payload.email);
    const source = normalizeText(payload.source) as LeadSource | undefined;
    const workspaceId = normalizeText(payload.workspaceId) ?? "default";

    if (!name || !email || !source) {
      return c.json({ error: "name, email, and source are required" }, 400);
    }

    if (!VALID_SOURCES.has(source)) {
      return c.json({ error: "invalid source" }, 400);
    }

    if (!isValidEmail(email)) {
      return c.json({ error: "invalid email" }, 400);
    }

    const phone = normalizeText(payload.phone) ?? null;
    const company = normalizeText(payload.company) ?? null;
    const message = normalizeText(payload.message) ?? null;
    const utmSource = normalizeText(payload.utmSource) ?? null;

    const lead = await store.createLead({
      workspaceId,
      name,
      email,
      phone,
      company,
      message,
      source,
      utmSource,
      score: scoreLead({ source, phone, company, utmSource }),
      status: "new",
      worked: false,
    });

    try {
      const pushResult = await pushLead(lead, deps.hubspotToken ?? process.env.HUBSPOT_TOKEN);
      if (pushResult.ok && pushResult.contactId) {
        await store.updateHubspotContactId(lead.id, pushResult.contactId);
        lead.hubspotContactId = pushResult.contactId;
      }
    } catch (error) {
      console.warn("HubSpot push failed", error);
    }

    return c.json({ lead }, 201);
  });

  app.get("/api/today", async (c) => {
    const workspaceId = c.req.query("workspaceId") ?? "default";
    const leads = await store.listLeadsByWorkspace(workspaceId);
    const today = priorityLeads(leads, 5);

    return c.json({ leads: today });
  });

  app.get("/api/leads", async (c) => {
    const workspaceId = c.req.query("workspaceId") ?? "default";
    const leads = await store.listLeadsByWorkspace(workspaceId);
    return c.json({ leads: leads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()) });
  });

  return app;
}

export function leadIds(leads: Lead[]): string[] {
  return leads.map((lead) => lead.id);
}
