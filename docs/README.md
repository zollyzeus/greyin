# docs/

Reorganized 2026-09-08 into subfolders by purpose, out of what had been ~30 files flat at this level. Each folder below is self-contained; cross-references between files were updated to their new paths, and so were the 14 references to these files from app/e2e code comments elsewhere in the repo.

- **`architecture/`** — `ARCHITECTURE_DECISIONS.{md,html}`, `ARCHITECTURE_DOCUMENTATION.{md,html}`. Why things are built the way they are, and the system's technical shape.
- **`audits/`** — `greyin-audit.html`, `greyin-security-audit-20260824.md`, `ENTERPRISE_PRODUCT_ROLLOUT_AUDIT_{CHECKLIST,REPORT}.md`, `greyin-links-audit.html`. Point-in-time reviews of the platform against a bar (security, enterprise-readiness, competitive feature parity, link health).
  - **`audits/competitive-analysis/`** — the Emergent comparison specifically: `emergent_code_audit.html`, `emergent_deployment_gap.md`, `emergent_greyin_requirements.csv`, `emergent-comparison-screenshots/`.
- **`roadmap/`** — `ROADMAP_AND_SCALING.html`, `gap_closure_plan.md` (the actively-maintained standing backlog — check here first for what's actually still open), `greyin_aws_migration_plan.html`, `ui_ux_elevation_plan.md`, `phase6_usability_test_plan.md`, `load_scaling_analysis.md`.
- **`requirements-traceability/`** — `build-requirements-tool/` (the generator script) and its output `greyin-requirements-traceability.xlsx`. Regenerate via `cd build-requirements-tool && node build-requirements.js "../greyin-requirements-traceability.xlsx"` after editing the script — this is the authoritative, single most up-to-date record of what's shipped, tested, and still pending across the whole platform.
- **`business-pitch/`** — `BUSINESS_METRICS_PITCH_SUMMARY.html`, `COMPLETE_PITCH_PACKAGE_README.md`, `Greyin_Budget_Rampup_3Year.xlsx`, `Greyin_Business_Metrics_PitchDeck.xlsx`, `greyin-benchmark.html`, `PitchDeck/` (the actual pitch deck versions, video, and script).

For "what's pending right now," `roadmap/gap_closure_plan.md` and `requirements-traceability/greyin-requirements-traceability.xlsx`'s own "Pending/Partial/Deferred" sheet are the two sources of truth — the rest of this tree is point-in-time snapshots, not living trackers.
