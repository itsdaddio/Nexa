/** Nexa core types — framework agnostic */

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "won"
  | "lost";

export type LeadSource =
  | "direct"
  | "utm"
  | "referral"
  | "agency"
  | "content";

export type ActivityType =
  | "note"
  | "status_change"
  | "call"
  | "email"
  | "hubspot_push"
  | "enrolled";

export type SequenceKind = "onboard" | "nurture" | "reengage";

export type MembershipRole = "owner" | "admin" | "operator";

export interface
