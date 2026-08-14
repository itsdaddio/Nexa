import type { Lead } from "./types.js";

export function priorityLeads(leads: Lead[], limit = 5): Lead[] {
  if (limit <= 0) {
    return [];
  }

  const openLeads = leads.filter((lead) => lead.status !== "won" && lead.status !== "lost");

  if (openLeads.length === 0) {
    return [];
  }

  const newestUnworked = openLeads
    .filter((lead) => !lead.worked)
    .reduce<Lead | undefined>((newest, lead) => {
      if (!newest) return lead;
      return lead.createdAt.getTime() > newest.createdAt.getTime() ? lead : newest;
    }, undefined);

  const prioritized = openLeads
    .filter((lead) => lead.score >= 40)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

  const picked: Lead[] = [];

  if (newestUnworked) {
    picked.push(newestUnworked);
  }

  for (const lead of prioritized) {
    if (picked.length >= limit) break;
    if (!picked.some((item) => item.id === lead.id)) {
      picked.push(lead);
    }
  }

  return picked.slice(0, limit);
}
