/**
 * Nexa scoring — pure function, no side effects.
 * Weights are fixed for v1. Cap at 99.
 */

export type LeadSource = "direct" | "utm" | "referral" | "agency" | "content";

export interface ScoreInput {
  source: LeadSource;
  phone?: string | null;
  company?: string | null;
  utmSource?: string | null;
}

export const SCORE_WEIGHTS = {
  base: 12,
  utm: 25,
  referral: 20,
  agency: 22,
  content: 10,
  phone: 10,
  company: 6,
  cap: 99,
} as const;

export function scoreLead(input: ScoreInput): number {
  let score = SCORE_WEIGHTS.base;

  switch (input.source) {
    case "utm":
      score
