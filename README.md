# M-Tech Public Pages

Public GitHub Pages site for M-Tech Industries LLC legal, privacy, support, security, and release information.

## Purpose

This repository contains public-facing documentation pages for M-Tech Industries apps. It is intended for information that can be published openly, such as privacy policies, patch notes, support contacts, security contact instructions, and lightweight legal terms placeholders.

Do not use this repository for private product code, credentials, internal implementation details, signing information, private roadmaps, or unreleased operational notes.

## Folder Structure

- `/index.html` - Root public landing page.
- `/afon.html` - Afon Browser product information and current release overview.
- `/afon/themes/` - Human-readable nine-theme gallery with existing previews and production resource links.
- `/afon-privacy.html` - Afon privacy policy.
- `/testing/` - Product testing hub.
- `/testing/afon/` - Afon testing information.
- `/testing/senta/` - Reserved testing route.
- `/testing/ironveil/` - Reserved testing route.
- `/patch-notes/` - Product patch notes hub.
- `/patch-notes/afon/` - Afon structured release history.
- `/patch-notes/senta/` - Reserved patch notes route.
- `/patch-notes/ironveil/` - Reserved patch notes route.
- `/legal/terms/afon/` - Afon terms information.
- `/known-issues/afon/` - Public Afon known issues.
- `/support/` - Support contact and support request guidance.
- `/legal/terms/` - Minimal public terms information.
- `/security/` - Security contact instructions.
- `/assets/css/` - Shared site styling.
- `/assets/data/patch-notes.json` - Structured release history, active issues (latest release), issue reconciliation, and current testing distribution data.
- `/assets/js/patch-notes.js` - Shared patch notes and testing renderer.

## Updating Pages

1. Keep language public-safe and factual.
2. Avoid unsupported privacy, security, anonymity, or protection claims.
3. Do not mention private repository names, internal bugs, credentials, signing keys, private account issues, or private roadmap details.
4. Verify links from the root page after changes.
5. Confirm nested pages use the correct relative path to `/assets/css/site.css`.
6. Review changes before committing.

## Security and Secrets

Never commit secrets, API keys, certificates, signing keys, account details, private implementation notes, or private customer information to this repository.

## Afon content inventory

| Content | Controlling files / data |
| --- | --- |
| Current release and release history | `assets/data/patch-notes.json` → `assets/js/patch-notes.js` → `patch-notes/afon/index.html` |
| Active known issues and compatibility | Latest release’s `knownIssues` / `compatibilityNotes` in the same JSON; rendered on release, testing, and known-issues pages |
| Historical issues / closure review | `products.afon.issueReview` in the same JSON; rendered on `known-issues/afon/index.html` |
| Product copy and static version labels | `index.html`, `afon.html`, `testing/afon/index.html`, `patch-notes/afon/index.html`, `support.html` |
| Distribution/testing records and links | `products.afon.testing` in the same JSON; existing version/build fields identify the current distributed testing release; iOS uses TestFlight and the Google Play track remains unconfirmed |
| Theme presentation | `afon/themes/index.html`; existing previews/manifests/packages under `themes/afon/` |
| Build 28 runtime theme discovery | `themes/afon/registry.json`; different from the three-entry reference `afon/themes/catalog.json` |
| Support / FAQ / contacts | `support.html`; contact addresses also appear in site footers |
| Privacy / terms / security | `afon-privacy.html`, `terms.html`, `security.html`; legacy aliases retain existing redirects |
| Reference hosting/lifecycle documentation | Theme READMEs and `docs/afon_theme_*.md`; these are not app runtime qualification receipts |

Run `node --test tests/*.test.mjs` and `python3 tests/site-content-check.py` for local checks. Browser QA and live resource checks are separate evidence. Do not assume store availability from the product release number. Before publication, obtain Owner approval and re-check the source diff, public resources, and production identity.

Longer term, generate static product labels, theme display data, and fallback copy from a shared structured source. For this update, current issue lists already share release data; the focused content check catches static version/catalog drift without changing runtime theme contracts.
