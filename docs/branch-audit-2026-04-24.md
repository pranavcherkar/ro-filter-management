# Branch audit: `work` (first commit vs latest)

Date: 2026-04-24

## Scope compared
- First commit on branch: `d8b9e61` (2026-01-27)
- Latest commit on branch: `de5fd8a` (2026-04-24)

## High-level delta
- Diff summary (`d8b9e61..de5fd8a`): **57 files changed**, **5734 insertions**, **1457 deletions**.
- Key themes across commits:
  1. Inventory management and UI/UX improvements.
  2. AMC data model + customer lifecycle additions.
  3. Configurable service cycle defaults and owner profile settings.
  4. Delete flows added for customer/service/invoice.
  5. Responsive UI updates and navbar logout.

## Commit timeline highlights
- `9ba6294`: inventory management added.
- `d96007b`: customer type + AMC lifecycle fields.
- `0154ee3`: default service cycle settings.
- `352434d`, `b1bfb21`, `430713a`, `2a8a3ba`: AMC details in customer UI, AMC payment API/invoice, AMC invoice filtering/PDF context.
- `2fed8c7`: soft/hard customer delete API + confirmation modal.
- `add2946`: service delete API + delete actions in service modals.
- `8833dfa`: invoice delete API + UI delete action.

## Verification of requested features

### 1) Customer delete service (implemented)
- Route exists: `DELETE /api/customers/:id`.
- Controller supports **soft** (mark inactive) and **hard** delete (cascade delete service+invoice docs and remove customer).
- Frontend has **Delete Customer** button and mode selector modal (soft/hard).

### 2) Service delete service (implemented)
- Route exists: `DELETE /api/services/:id`.
- Controller deletes service, removes linked SERVICE invoices, recomputes customer service schedule.
- Frontend delete action is available in service detail modal(s), not as a large standalone list-row CTA.

### 3) Invoice delete service (implemented)
- Route exists: `DELETE /api/invoices/:id`.
- Controller enforces guardrails (service-link integrity, reference checks, active-customer filter-sale restriction, latest-AMC-payment protection) before deletion.
- Frontend has Delete Invoice button on invoice cards.

### 4) AMC feature set (implemented)
- Customer model includes `customerType` + `amcContract` fields.
- Invoice model includes `AMC_PAYMENT` type.
- Customer routes include AMC payment endpoint: `POST /api/customers/:id/amc-payment`.
- Customer detail page renders AMC detail card; invoice list includes AMC type filter.

## Why branch may feel "same as old"
- Several changes are backend/API or conditional UI states, so they are not obvious on first screen load.
- Service delete controls are inside detail modals (customer/service pages), not always visible until you open a service.
- Customer delete is on customer detail page; if you mostly use list/dashboard views, it can be missed.
- Invoice delete can be blocked intentionally by integrity rules (returns conflict), so behavior may appear unchanged if testing with protected records.

