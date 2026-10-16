# Skellow

<!-- impeccable:product-schema 1 -->

## Platform

web

## Product Purpose

Skellow manages nightclub staffing: weekly shifts, employee records, and payroll preparation. This description is inferred from the existing application and its demonstration data; no new product claims are introduced.

## Users

Existing roles: administrators manage employees, shifts and pay preparation; employees consult their own planning and overview.

## Capabilities and Constraints

React, TypeScript, Vite. A configurable Supabase mode provides Auth accounts, shared employee/shift records, database-enforced admin/employee access, revision-checked writes and explicit local-data import. It models one establishment per Supabase project; a hosted project still needs to be configured following BACKEND.md. Without configuration, the existing localStorage demonstration remains available with its original data keys. Preserve payroll calculation rules: payroll remains a browser estimate, not a certified payslip service. Demonstration records are supplied in src/data.ts. No external messaging, invitations or realtime synchronization is implemented.

## Brand Commitments

User requested a complete premium redesign, following two supplied light dashboard references, with clear working controls, restrained liquid glass and expressive purposeful motion. Visual implementation is delegated to the agent. Keep Skellow and French interface copy.

## Evidence on Hand

Baseline: fe9dc55. References: .context/attachments/33eVuZ/réf sky2.jpg and .context/attachments/qFPsW2/réf sky.jpg (actual filesystem filenames use decomposed accents). Existing source code is authority for functionality and records.

## Product Principles

- Make the working week readable at a glance.
- Every visible command performs a clear action.
- Preserve user data and communicate real state.
- Work with keyboard, mobile touch and reduced motion.
