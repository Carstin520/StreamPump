# StreamPump Phase 0 Product Readiness

Date: 2026-05-13

This document freezes the post-hackathon product boundary. It compares the pitch promise with the current implementation so the next development phases can proceed without overstating demo-only or operator-driven paths.

## Status Legend

| Status | Meaning |
| --- | --- |
| `LIVE` | Product UI and backend path are usable against the intended devnet/runtime flow. |
| `SEEDED_DEMO` | Works for the hackathon demo after seed scripts or prepared devnet state. |
| `MOCK_PREVIEW` | Frontend-only or local simulated behavior; not a real product workflow. |
| `BACKEND_READY_UI_GAP` | Backend/API/chain builder exists, but user-facing UI is incomplete. |
| `OPERATOR_REQUIRED` | Requires scripts, manual operator action, or controlled data setup. |
| `NOT_STARTED` | No reliable product implementation yet. |

## Readiness Matrix

| Product area | Current status | What is safe to demo now | Do not claim yet |
| --- | --- | --- | --- |
| S1 market buy/sell | `SEEDED_DEMO` | Fans can buy/sell S1 positions through the live S1 market UI when the creator market is seeded and backend transaction builders are configured. | Do not claim open creator onboarding, rating oracle operations, or all market states are production-ready. |
| S1 portfolio claim | `SEEDED_DEMO` | A seeded holder can view S1 positions and claim USDC from a graduated buyout state. | Do not claim the whole buyout lifecycle is user-created from the UI. |
| S1 buyout formation | `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED` | The protocol and backend expose buyout builder paths, and the demo can start from prepared buyout state. | Do not claim sponsor offer creation, creator acceptance, rage quit, graduation, or reclaim are fully productized. |
| S2 proposal launch | `SEEDED_DEMO` | With an S2-ready creator, the workspace can move through content manifest, proposal intent, signing, sponsor submit, and relay paths. | Do not claim any creator can self-serve into S2 without seed/upgrade readiness. |
| S2 endorsement | `MOCK_PREVIEW` | The endorsement page can explain fan-side mechanics with local SPUMP stake simulation. | Do not present endorsement as a live chain/API integration. |
| Settlement Track 1 | `SEEDED_DEMO` | Fixed base pay settlement exists in the program/backend settlement spine for controlled data. | Do not claim unattended production oracle operations. |
| Settlement Track 2 | `SEEDED_DEMO` + `OPERATOR_REQUIRED` | Performance settlement can be smoked with known seeded metrics/events. | Do not claim external metric ingestion, fraud review, or automatic oracle operation is production-ready. |
| Settlement Track 3 | `MOCK_PREVIEW` + `OPERATOR_REQUIRED` | CPS economics can be shown in demo settlement surfaces. | Do not claim Shopify, Amazon, or other merchant reconciliation is integrated. |
| Media publication | `BACKEND_READY_UI_GAP` | Content manifest, upload, finalize, and Mux/R2 plumbing exist for controlled flows. | Do not claim a complete creator publication/review pipeline with robust failure recovery. |
| Auth and wallet sessions | `SEEDED_DEMO` + `MOCK_PREVIEW` | Wallet session and preview login paths are usable for local/demo flows. | Do not claim production-grade OAuth/Web3Auth verification or managed wallet custody. |
| Operator tooling | `OPERATOR_REQUIRED` | Operators can use scripts, logs, and controlled env settings during the demo. | Do not claim dashboards for oracle, fraud review, indexer, Mux reconciliation, or settlement retry exist. |

## Current Demo Boundary

The current hackathon build should be presented as two controlled paths:

1. S1 controlled demo: seeded creator market, live buy/sell where configured, portfolio view, and claim from a prepared graduated buyout state.
2. S2 controlled demo: seeded S2-ready creator, content manifest/proposal intent/signing path, and settlement spine with controlled data.

The following surfaces are explicitly preview-only until later phases:

- Rewards missions and daily claim.
- Workspace buyout offer management.
- S2 fan endorsement.
- Campaign settlement dashboard when shown with local `MOCK` data.

## Phase 0 Follow-Up Defaults

- Keep mock surfaces visible in development, but label them as demo/readiness-only.
- Prefer connecting existing backend builders to the current frontend shell before adding new abstractions.
- Keep Track 3 behind operator control until a real merchant reconciliation source exists.
- Keep oracle scheduler disabled for public demos unless a known seeded settlement test is being run.
