# Baulogic Planning Portal

Internal tool for surfacing qualified Tier 1 planning approvals to work as new business leads.

## What it does

Filters our historical Planning Pipe dataset (2023–2024, ~3,900 qualified projects) down to schemes that match Baulogic's "entry-level luxury" strategy: prime postcodes (London / Surrey luxury triangle / Cotswolds), developers/architects/builders/contractors only (no councils, no housing associations, no volume housebuilders).

Three tabs:
- **Find** — browse, search and filter the qualified database
- **My Schemes** — track contacted developers and progress toward the 20-scheme target
- **Scan** — (coming soon) paste a council planning portal URL and pull live applications

Status and notes are saved to browser localStorage on this machine.

## Stack

Static HTML / CSS / vanilla JS. No frameworks, no build step.
- `index.html` — markup
- `styles.css` — dark premium theme
- `app.js` — logic
- `data.json` — qualified projects
- `nixpacks.toml` — Railway deployment config

## Filter rules (v1, locked 28 May 2026)

Project qualifies if ALL of:
- In a prime postcode (London prime / Surrey luxury triangle / Cotswolds)
- Applicant is a developer/architect/builder/contractor (not council, HA, individual, SPV)
- Residential (not hotel, care home, office, leisure)

AND one of:
- **Single dwelling premium:** 1 unit, prime postcode, AND (3,000+ sqft OR £750k+ build value)
- **Boutique multi-unit:** 2–15 units, prime postcode, decent build value
- **Larger multi-unit (boutique developer):** 16–100 units, prime postcode, NOT a volume housebuilder

## Confidential

Internal Baulogic tool. Not for external sharing.
