import { Hono } from "hono";
import { cors } from "hono/cors";
import { html } from "hono/html";
import { randomUUID } from "node:crypto";
import type { Lead } from "./types.js";
import { scoreLead } from "./scoring.js";
import { pushLeadToHubSpot } from "./hubspot.js";
import { priorityLeads } from "./priority.js";
import { InMemoryLeadStore, type LeadStore } from "./db.js";
import type { LeadSource } from "./types.js";

const VALID_SOURCES = new Set<LeadSource>(["direct", "utm", "referral", "agency", "content"]);

export interface Workspace {
  id: string;
  name: string;
  publicKey: string;
  createdAt: Date;
}

/** In-memory workspaces (same process lifetime as lead store). */
const workspacesByKey = new Map<string, Workspace>();
const workspacesById = new Map<string, Workspace>();

function ensureDefaultWorkspace(): Workspace {
  const existing = workspacesById.get("default");
  if (existing) return existing;
  const ws: Workspace = {
    id: "default",
    name: "Default",
    publicKey: "nexa_pk_default",
    createdAt: new Date(),
  };
  workspacesById.set(ws.id, ws);
  workspacesByKey.set(ws.publicKey, ws);
  return ws;
}

function createWorkspace(name: string): Workspace {
  const id = randomUUID();
  const publicKey = `nexa_pk_${id.replace(/-/g, "").slice(0, 16)}`;
  const ws: Workspace = { id, name, publicKey, createdAt: new Date() };
  workspacesById.set(id, ws);
  workspacesByKey.set(publicKey, ws);
  return ws;
}

function resolveWorkspace(publicKey?: string, workspaceId?: string): Workspace | null {
  ensureDefaultWorkspace();
  if (publicKey) return workspacesByKey.get(publicKey) ?? null;
  if (workspaceId) return workspacesById.get(workspaceId) ?? null;
  return workspacesById.get("default") ?? null;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function baseUrlFromRequest(c: { req: { url: string } }): string {
  try {
    const u = new URL(c.req.url);
    return `\( {u.protocol}// \){u.host}`;
  } catch {
    return "https://nexa-app-its-dads-projects.vercel.app";
  }
}

function embedSnippet(publicKey: string, origin: string): string {
  return `<!-- Nexa lead form -->
<script src="\( {origin}/embed.js" data-nexa-key=" \){publicKey}" async></script>
<div id="nexa-form"></div>`;
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
  ensureDefaultWorkspace();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "POST", "OPTIONS"],
      allowHeaders: ["Content-Type"],
    }),
  );

  app.get("/", (c) => c.redirect("/install"));

  /** Install / get embed code */
  app.get("/install", (c) => {
    const origin = baseUrlFromRequest(c);
    return c.html(
      html`<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Install Nexa</title>
            <style>
              :root {
                --bg: #0a0a0b;
                --surface: #141416;
                --border: #2a2a2e;
                --text: #fff;
                --muted: #a1a1aa;
                --accent: #2ba4ff;
              }
              * { box-sizing: border-box; }
              body {
                margin: 0; font-family: system-ui, sans-serif;
                background: var(--bg); color: var(--text);
                line-height: 1.5; padding: 2rem 1.25rem;
              }
              .wrap { max-width: 640px; margin: 0 auto; }
              h1 { font-size: 1.75rem; margin: 0 0 0.5rem; }
              p { color: var(--muted); }
              label { display: block; font-size: 0.9rem; margin-bottom: 0.35rem; color: var(--muted); }
              input {
                width: 100%; padding: 0.75rem; border-radius: 10px;
                border: 1px solid var(--border); background: var(--surface);
                color: var(--text); font: inherit; margin-bottom: 1rem;
              }
              button {
                background: var(--accent); color: #0a0a0b; border: 0;
                border-radius: 999px; padding: 0.75rem 1.25rem;
                font-weight: 700; font: inherit; cursor: pointer;
              }
              pre {
                background: var(--surface); border: 1px solid var(--border);
                border-radius: 12px; padding: 1rem; overflow-x: auto;
                font-size: 0.85rem; white-space: pre-wrap;
              }
              .card {
                background: var(--surface); border: 1px solid var(--border);
                border-radius: 14px; padding: 1.25rem; margin-top: 1.5rem;
              }
              .hidden { display: none; }
              a { color: var(--accent); }
            </style>
          </head>
          <body>
            <div class="wrap">
              <h1>Install Nexa on your site</h1>
              <p>Create a workspace, copy the snippet, paste it before <code>&lt;/body&gt;</code> on any page.</p>
              <form id="create">
                <label for="name">Site or business name</label>
                <input id="name" name="name" required placeholder="Acme Plumbing" />
                <button type="submit">Get install code</button>
              </form>
              <div id="result" class="card hidden">
                <p><strong>Your public key</strong></p>
                <pre id="key"></pre>
                <p><strong>Paste this on your website</strong></p>
                <pre id="snippet"></pre>
                <p>
                  Direct form link:
                  <a id="formlink" href="#" target="_blank" rel="noopener"></a>
                </p>
                <p>
                  Today list (JSON):
                  <a id="todaylink" href="#" target="_blank" rel="noopener"></a>
                </p>
              </div>
            </div>
            <script>
              const origin = ${JSON.stringify(origin)};
              document.getElementById("create").addEventListener("submit", async (e) => {
                e.preventDefault();
                const name = document.getElementById("name").value.trim();
                const res = await fetch("/api/workspaces", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ name }),
                });
                const data = await res.json();
                if (!res.ok) {
                  alert(data.error || "Could not create workspace");
                  return;
                }
                document.getElementById("result").classList.remove("hidden");
                document.getElementById("key").textContent = data.workspace.publicKey;
                document.getElementById("snippet").textContent = data.embedSnippet;
                const formUrl = origin + "/e/" + data.workspace.publicKey;
                const todayUrl = origin + "/api/today?workspaceId=" + encodeURIComponent(data.workspace.id);
                const fl = document.getElementById("formlink");
                fl.href = formUrl;
                fl.textContent = formUrl;
                const tl = document.getElementById("todaylink");
                tl.href = todayUrl;
                tl.textContent = todayUrl;
              });
            </script>
          </body>
        </html>`,
    );
  });

  /** Create workspace + return embed snippet */
  app.post("/api/workspaces", async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = normalizeText(body.name) ?? "My site";
    const workspace = createWorkspace(name);
    const origin = baseUrlFromRequest(c);
    return c.json(
      {
        workspace: {
          id: workspace.id,
          name: workspace.name,
          publicKey: workspace.publicKey,
        },
        embedSnippet: embedSnippet(workspace.publicKey, origin),
        formUrl: `\( {origin}/e/ \){workspace.publicKey}`,
        todayUrl: `\( {origin}/api/today?workspaceId= \){encodeURIComponent(workspace.id)}`,
      },
      201,
    );
  });

  /** Embed script for customer sites */
  app.get("/embed.js", (c) => {
    const origin = baseUrlFromRequest(c);
    const js = `(function(){
  var s=document.currentScript;
  var key=s && s.getAttribute("data-nexa-key");
  if(!key){console.warn("Nexa: missing data-nexa-key");return;}
  var target=document.getElementById("nexa-form")||s.parentNode;
  var iframe=document.createElement("iframe");
  iframe.src=${JSON.stringify(origin)}+"/e/"+encodeURIComponent(key);
  iframe.title="Nexa lead form";
  iframe.style.cssText="width:100%;max-width:480px;height:520px;border:0;border-radius:12px;";
  iframe.loading="lazy";
  target.appendChild(iframe);
})();`;
    return c.body(js, 200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    });
  });

  /** Hosted embed form for a public key */
  app.get("/e/:publicKey", (c) => {
    const publicKey = c.req.param("publicKey");
    const ws = resolveWorkspace(publicKey);
    if (!ws) return c.text("Unknown Nexa key", 404);

    return c.html(
      html`<!doctype html>
        <html lang="en">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>Contact — Nexa</title>
            <style>
              body {
                margin: 0; font-family: system-ui, sans-serif;
                background: #0a0a0b; color: #fff; padding: 1rem;
              }
              form {
                max-width: 420px; margin: 0 auto;
                background: #141416; border: 1px solid #2a2a2e;
                border-radius: 14px; padding: 1.25rem;
              }
              h1 { font-size: 1.15rem; margin: 0 0 1rem; }
              label { display: block; font-size: 0.8rem; color: #a1a1aa; margin: 0.5rem 0 0.25rem; }
              input, textarea, select {
                width: 100%; box-sizing: border-box; padding: 0.6rem;
                border-radius: 8px; border: 1px solid #2a2a2e;
                background: #0a0a0b; color: #fff; font: inherit;
              }
              button {
                margin-top: 1rem; width: 100%; padding: 0.75rem;
                border: 0; border-radius: 999px; background: #2ba4ff;
                color: #0a0a0b; font-weight: 700; font: inherit; cursor: pointer;
              }
              .ok { color: #5bb8ff; margin-top: 0.75rem; display: none; }
              .err { color: #f87171; margin-top: 0.75rem; display: none; }
            </style>
          </head>
          <body>
            <form id="f">
              <h1>Get in touch</h1>
              <input type="hidden" name="publicKey" value="${ws.publicKey}" />
              <input type="hidden" name="source" value="direct" />
              <label>Name</label>
              <input name="name" required />
              <label>Email</label>
              <input name="email" type="email" required />
              <label>Phone</label>
              <input name="phone" />
              <label>Company</label>
              <input name="company" />
              <label>Message</label>
              <textarea name="message" rows="3"></textarea>
              <button type="submit">Send</button>
              <div class="ok" id="ok">Thanks — we got it.</div>
              <div class="err" id="err"></div>
            </form>
            <script>
              document.getElementById("f").addEventListener("submit", async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const body = Object.fromEntries(fd.entries());
                document.getElementById("ok").style.display = "none";
                document.getElementById("err").style.display = "none";
                const res = await fetch("/api/leads", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  document.getElementById("err").textContent = data.error || "Something went wrong";
                  document.getElementById("err").style.display = "block";
                  return;
                }
                document.getElementById("ok").style.display = "block";
                e.target.reset();
              });
            </script>
          </body>
        </html>`,
    );
  });

  app.get("/capture", (c) =>
    c.html(
      html`<!doctype html>
        <html>
          <body>
            <h1>Nexa Capture</h1>
            <p><a href="/install">Install on your website →</a></p>
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
    const sourceRaw = normalizeText(payload.source) ?? "direct";
    const source = sourceRaw as LeadSource;
    const publicKey = normalizeText(payload.publicKey);
    const workspaceIdInput = normalizeText(payload.workspaceId);

    const ws = resolveWorkspace(publicKey, workspaceIdInput);
    if (!ws) {
      return c.json({ error: "invalid publicKey or workspaceId" }, 400);
    }

    if (!name || !email) {
      return c.json({ error: "name and email are required" }, 400);
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
      workspaceId: ws.id,
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
    const publicKey = c.req.query("publicKey");
    const workspaceId = c.req.query("workspaceId") ?? "default";
    const ws = resolveWorkspace(publicKey, workspaceId);
    if (!ws) return c.json({ error: "unknown workspace" }, 404);
    const leads = await store.listLeadsByWorkspace(ws.id);
    const today = priorityLeads(leads, 5);
    return c.json({ leads: today, workspaceId: ws.id });
  });

  app.get("/api/leads", async (c) => {
    const publicKey = c.req.query("publicKey");
    const workspaceId = c.req.query("workspaceId") ?? "default";
    const ws = resolveWorkspace(publicKey, workspaceId);
    if (!ws) return c.json({ error: "unknown workspace" }, 404);
    const leads = await store.listLeadsByWorkspace(ws.id);
    return c.json({
      leads: leads.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
      workspaceId: ws.id,
    });
  });

  return app;
}

export function leadIds(leads: Lead[]): string[] {
  return leads.map((lead) => lead.id);
}
