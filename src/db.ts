import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";
import type { CreateLeadInput, Lead, LeadStatus } from "./types.js";

export interface LeadStore {
  createLead(input: CreateLeadInput & { score: number; status: LeadStatus; worked: boolean }): Promise<Lead>;
  listLeadsByWorkspace(workspaceId: string): Promise<Lead[]>;
  updateHubspotContactId(leadId: string, hubspotContactId: string): Promise<void>;
}

export async function loadSchemaSql(): Promise<string> {
  const schemaPath = path.resolve(process.cwd(), "src/schema.sql");
  return readFile(schemaPath, "utf8");
}

function toLead(row: {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  message: string | null;
  source: Lead["source"];
  score: number;
  status: LeadStatus;
  worked: boolean;
  hubspot_contact_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}): Lead {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    company: row.company,
    message: row.message,
    source: row.source,
    score: row.score,
    status: row.status,
    worked: row.worked,
    hubspotContactId: row.hubspot_contact_id,
    createdAt: row.created_at instanceof Date ? row.created_at : new Date(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at : new Date(row.updated_at),
  };
}

export class InMemoryLeadStore implements LeadStore {
  private leads: Lead[] = [];

  async createLead(input: CreateLeadInput & { score: number; status: LeadStatus; worked: boolean }): Promise<Lead> {
    const now = new Date();
    const lead: Lead = {
      id: randomUUID(),
      workspaceId: input.workspaceId,
      name: input.name,
      email: input.email,
      phone: input.phone ?? null,
      company: input.company ?? null,
      message: input.message ?? null,
      source: input.source,
      score: input.score,
      status: input.status,
      worked: input.worked,
      hubspotContactId: null,
      createdAt: now,
      updatedAt: now,
    };

    this.leads.push(lead);
    return lead;
  }

  async listLeadsByWorkspace(workspaceId: string): Promise<Lead[]> {
    return this.leads.filter((lead) => lead.workspaceId === workspaceId);
  }

  async updateHubspotContactId(leadId: string, hubspotContactId: string): Promise<void> {
    this.leads = this.leads.map((lead) =>
      lead.id === leadId
        ? { ...lead, hubspotContactId, updatedAt: new Date() }
        : lead,
    );
  }
}

export class PostgresLeadStore implements LeadStore {
  constructor(private readonly pool: Pool) {}

  async applySchema(): Promise<void> {
    const schemaSql = await loadSchemaSql();
    await this.pool.query(schemaSql);
  }

  async createLead(input: CreateLeadInput & { score: number; status: LeadStatus; worked: boolean }): Promise<Lead> {
    const id = randomUUID();
    const query = await this.pool.query(
      `
      INSERT INTO leads (
        id, workspace_id, name, email, phone, company, message,
        source, score, status, worked, utm_source
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, workspace_id, name, email, phone, company, message,
        source, score, status, worked, hubspot_contact_id, created_at, updated_at
      `,
      [
        id,
        input.workspaceId,
        input.name,
        input.email,
        input.phone ?? null,
        input.company ?? null,
        input.message ?? null,
        input.source,
        input.score,
        input.status,
        input.worked,
        input.utmSource ?? null,
      ],
    );

    return toLead(query.rows[0]);
  }

  async listLeadsByWorkspace(workspaceId: string): Promise<Lead[]> {
    const query = await this.pool.query(
      `
      SELECT id, workspace_id, name, email, phone, company, message,
        source, score, status, worked, hubspot_contact_id, created_at, updated_at
      FROM leads
      WHERE workspace_id = $1
      `,
      [workspaceId],
    );

    return query.rows.map(toLead);
  }

  async updateHubspotContactId(leadId: string, hubspotContactId: string): Promise<void> {
    await this.pool.query(
      `UPDATE leads SET hubspot_contact_id = $2, updated_at = now() WHERE id = $1`,
      [leadId, hubspotContactId],
    );
  }
}

export async function createLeadStore(): Promise<LeadStore> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return new InMemoryLeadStore();
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const store = new PostgresLeadStore(pool);
  await store.applySchema();
  return store;
}
