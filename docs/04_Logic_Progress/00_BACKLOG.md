# Backlog
> Created: 2026-09-13 00:00
> Last Updated: 2026-09-13 00:00

## TASK-001 — Referral curious illustration
- Work Type: code
- Scope: approved curious.png teaser image, remove teaser graph, approved heading and CTA.
- Related Concept Docs: [Product decisions](../01_Concept_Design/00_PRODUCT_DECISION_LOG.md)
- Related UI Docs: [Flow](../02_UI_Screens/00_SCREEN_FLOW.md), [Design](../02_UI_Screens/01_UI_DESIGN.md)
- Related HTML Preview: N/A - user reviewed supplied curious.png and explicitly approved narrow image/layout change; full import preview remains pending.
- Related Technical Docs: [Principles](../03_Technical_Specs/00_DEVELOPMENT_PRINCIPLES.md), [API](../03_Technical_Specs/02_API_SPECS.md)
- Related QA Docs: [Verification](../05_QA_Validation/01_REFERRAL_ART_QA.md)
- Implementation Preconditions: preserve unrelated dirty changes, reuse next/image and original PNG, no new dependencies/API/state changes.
- Context Receipt:
  - Status: PASS
  - Required References Read: Context agent read all Concept/UI/Technical links above, AGENTS, README, ReferralLanding and harness; coordinator read local Next image guide. QA report created after verification.
  - Constraints: teaser only; preserve actual results and post-start flow.
  - Conflicts: None
- Acceptance Criteria: initial referral shows two curious characters; no sample graph; responsive 300px illustration; existing results keep actual diagram.
- Document Sync Check: UI documents record only narrow user approval.
- Internal CLI: unavailable offline (solmate-skills ENOTCACHED); independent receipts used, CLI PASS not claimed.
- Change Receipt:
  - Files Changed: ReferralLanding.tsx, globals.css, public/assets/curious.png, narrow UI approval documentation.
  - Requirements Covered: approved illustration/title/CTA; teaser graph removed; later screens preserved.
  - Excluded Scope: broader onboarding redesign.
  - Basic Checks: web typecheck PASS; source/public PNG byte equality PASS.
  - Remaining Risks: browser layout not observed; localhost unavailable.
- Verification Receipt:
  - Status: PASS
  - Commands and Results: web typecheck PASS; git diff --check PASS; PNG equality PASS.
  - Unrun Checks: browser unavailable; offline harness CLI unavailable.
  - Detailed Evidence: [Independent verification](../05_QA_Validation/01_REFERRAL_ART_QA.md)
