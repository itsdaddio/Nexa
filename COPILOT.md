# Copilot / Agent Instructions — Nexa

Use this file when continuing work on the Nexa repo.

## Product constraints (do not violate)

- **Brand-agnostic.** No “It’s Dad”, no “DadForge”, no solar, no GreyFox, no personal branding.
- **White-label ready.** Any business can use it.
- **HubSpot is first-class.** Capture → create-or-update contact is a core path, not a plugin.
- **TBI-friendly UX.** Today screen shows **3–5 actions max**. Clear labels. No dense dashboards as the primary view.
- **Newest unworked capture always gets a slot** on the priority list.

## Architecture targets

- Multi-tenant via `workspace_id` on all core tables
- Postgres (schema is portable; avoid MySQL-only features)
- Core scoring and HubSpot logic stay framework-agnostic in `src/`
- UI can be Next.js, TanStack Start, or Hono + React

## Scoring rules (keep stable)
