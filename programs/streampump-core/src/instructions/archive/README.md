# Archived Legacy S2 Instructions

These instructions are archived and no longer part of the active program routing:

- `submit_oracle_report.rs`
- `settle_proposal.rs`

Reason: StreamPump S2 has migrated to the dual-track settlement model:

- `settle_track1` (pro-rata A3 seeding)
- `settle_track2` (delayed CPS payout)

`instructions/mod.rs` and `lib.rs` expose only the active instruction surface.
