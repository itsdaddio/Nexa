# Nexa — Product Requirements Document

## 1. Vision

Nexa is a multi-tenant lead operating system. It turns inbound captures and partner referrals into scored, prioritized daily work — then syncs cleanly to HubSpot.

It is deliberately brand-agnostic so it can be sold or licensed to any business.

## 2. Goals

- Reduce “lead sitting in a form forever”
- Give every user a short, high-signal daily action list
- Make scoring transparent and consistent
- Treat HubSpot as a first-class destination, not an afterthought
- Support multi-tenant workspaces from day one

## 3. Non-goals (MVP)

- Full email marketing suite
- Native dialer / SMS provider
- AI auto-reply
- Complex territory or commission rules
- Vertical-specific templates (solar, real estate, etc.)

## 4. Personas

| Persona | Need |
|---------|------|
| Operator | Opens app → sees 3–5 things to do → marks done |
| Owner / Admin | Connects HubSpot, manages sequences, reviews reports |
| Partner / Referrer | Shares a unique link; lead is attributed |
| Lead (external) | Fills a clean public form |

## 5. User stories

### Capture
- As a visitor, I can submit name, email, phone, company, and optional message.
- As a partner, I can share /r/{code} so leads I send are attributed to me.
- As the system, I score every new lead immediately and assign status new.

### Today
- As an operator, I see at most 5 prioritized leads.
- As an operator, the newest unworked capture always appears.
- As an operator, I can mark an action done and leave a note.

### Inbox & Pipeline
- As an operator, I can filter leads by status and score.
- As an operator, I can change status (new → contacted → qualified → proposal → won/lost).
- As an operator, I can open a lead and see the activity timeline.

### Sequences
- As an admin, I can define onboard / nurture / re-engage sequences.
- As an operator, I can enroll a lead from the lead detail screen.

### HubSpot
- As an admin, I can connect a HubSpot portal.
- As the system, on capture I create or update the contact with score and source.
- As an operator, I can trigger a manual push from lead detail.

### Referrals
- As an admin, I can create referral partners and codes.
- As the system, I attribute captures that arrive via referral codes.

## 6. Scoring (v1)

base 12 + utm 25 + referral 20 + agency 22 + content 10 + phone 10 + company 6, cap 99.

## 7. Priority list

Open leads only. Newest unworked always included. Remaining slots by score ≥ 40, score desc. Cap 5.
