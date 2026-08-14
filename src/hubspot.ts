/**
 * HubSpot create-or-update shape for Nexa captures.
 * Failures must not block lead capture — log as activity instead.
 */

import type { Lead } from "./types.js";

export interface HubSpotContactProperties {
  email: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  company?: string;
  nexa_score?: string;
  nexa_source?: string;
  nexa_status?: string;
  nexa_lead_id?: string;
}

export interface HubSpotPushResult {
  ok: boolean;
  contactId?: string;
  error?: string;
}

export function splitName(full: string): { firstname: string; lastname: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstname: parts[0] ?? "", lastname: "" };
  return {
    firstname: parts[0],
    lastname: parts.slice(1).join(" "),
  };
}

export function leadToHubSpotProperties(lead: {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  score: number;
  source: string;
  status: string;
}): HubSpotContactProperties {
  const { firstname, lastname } = splitName(lead.name);
  return {
    email: lead.email,
    firstname,
    lastname,
    phone: lead.phone ?? undefined,
    company: lead.company ?? undefined,
    nexa_score: String(lead.score),
    nexa_source: lead.source,
    nexa_status: lead.status,
    nexa_lead_id: lead.id,
  };
}

/**
 * Stub implementation for P0 foundation.
 * Replace with real HubSpot API call in later milestones.
 */
export async function pushLeadToHubSpot(
  lead: Pick<Lead, "id" | "name" | "email" | "phone" | "company" | "score" | "source" | "status">,
  hubspotToken?: string,
): Promise<HubSpotPushResult> {
  if (!hubspotToken) {
    return { ok: false, error: "Missing HubSpot token" };
  }

  leadToHubSpotProperties(lead);

  return {
    ok: true,
    contactId: `stub-${lead.id}`,
  };
}
