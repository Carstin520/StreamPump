# StreamPump P5/P6 新窗口交接 Prompt

请继续 StreamPump，但必须先停在 H4 gate：**只有我在新窗口明确批准 H4 后，才可开始 P5；P5 到 H5、P6 到 H6 都必须再次停在人审。** 不得把本交接视为 H4 批准。

## 先读与工作区

工作仓库：`/Users/jamesli/Developer/Sol Projects/StreamPump`。先完整读取仓库 `AGENTS.md` / `CLAUDE.md`，以及：

1. `docs/streamPump-long-term-roadmap.md`
2. `pitch/script.md`
3. `docs/product-readiness-phase-0.md`
4. `README.md`
5. `README.zh-CN.md`
6. `DEMO.md`
7. `docs/streamPump-page-readiness-goal.md`
8. `docs/pilot/p4-pre-mutation-checklist.md`
9. `docs/pilot/p4-rollback-bundle.md`
10. `docs/pilot/p4-m6-disposable-corridor-and-track1-runbook.md`

先检查 branch/status/upstream，保护用户原 workspace 的 dirty state。H4 获批后，从 `origin/codex/p4-pilot-deployment` 的最新交接 commit 创建干净 worktree，建议 P5 分支 `codex/p5-pilot-hardening`；P6 另开阶段分支。禁止修改、暂存或提交：

- `backend/package-lock.json`
- `pitch/colosseum-submission.md`
- `pitch/demo-youtube-description.md`

仅使用显式 `git add <path>`，不得输出/提交 env、secret、keypair、RPC/DB URL 或 session token。

## P4 最终事实：复用，不要重跑

- 边界始终是 invite-only、external-wallet-first、Solana devnet、test-USDC、Track1-only、manual/operator-only、无真实资金，且不是正式生产上线。
- S1、Track2、Track3、endorsement、rewards、managed/email/social auth、public managed execution、prototype routes 与所有自动 settlement 均关闭。
- Render service `srv-d79rs0450q8c73fp2lmg`：deploy `dep-d9auio7lk1mc73c4r18g`，backend `88c0debad6ecb7eacfe9e24793951f3794353f4c`，auto-deploy off；`/health` 为 `INVITE_ONLY_PILOT`、`automatedSettlement=false`、release `88c0deb`；`/ready` 为 `READY`。
- Vercel Production 未因 H4 cleanup 重部署：deployment `dpl_6f9LBgHRqB8hCywV5DimXfV9YqUK`，frontend `097e9805b197398ae1c04cf5bf84f1044b3b2f19`。
- 唯一 allowlist wallet：`GYjkMEZEFHuY4uRZVwE79eeXAGtoneh53gb49X4HqCMH`。两只 disposable actors 已移除；它们的本地签名验证有效，线上均返回 controller 为防枚举而隐藏的 `401 AUTH_CHALLENGE_INVALID`。
- Program ID `FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp`；ProgramData capacity 1,328,344；live padded SHA256 `a6008d9c11304c73324db9f5645ccd4e303015f0e0f03671f3d41fd42a720732`；升级 finalized slot 475933115。ProgramData 扩容不可回滚，程序字节可用 durable rollback artifact 恢复。
- Pilot test-USDC mint `5Z5MpM3KaM9mb4hXweS7oEuWja5kEJ4Me1Xycu7wBXQJ`，legacy SPL、6 decimals、devnet test only、无 freeze authority。
- Neon project `jolly-recipe-31299801`，production branch `br-orange-bar-ancofkw5`，PostgreSQL 17，26 migrations applied；restore branch `br-frosty-fire-an0lsiq2` 必须继续保留，不得自动迁移或删除。
- Mux environment `lnv5m1` 只有 `https://api.stream-pump.com/api/webhooks/mux` enabled；M5 disposable asset/object 已删除。
- M6 proposal `FPV64F3YL2uCnU1PLfMzUH34WAAvbPFV5ERcJRKGen29`；manual Track1 为 1,000,000 raw；settlement/replay 同一签名 `5hjVwnw5QAvApWbNda2okCkN7mkQHcTZfyN6GaPbn4fGzhtU4x5GfVqzqG42F4V8SzEdR1KXQkhTtC3MBVUKrdFV`，`attemptCount=1`，余额 `0 -> 1,000,000 -> 1,000,000`；Track2/3 为零，auto settlement off。
- P4 Fable 已覆盖且禁止重跑：`80be8eb..a1de424`、`a1de424..5d07748`、`5d07748..67ec60c`。Neon runtime-gate fix 的 closure `0edcd37..88c0deb` 为 0 blocker/major/minor。

Durable evidence 在 `/Users/jamesli/.local/share/streampump/p4/2026-07-13-pre-mutation`。按需读取、先检查 mode，不要整份输出。重点文件：

- `m6-p4m6-20260713-a-track1-settlement.json`
- `m6-p4m6-20260713-a-actor-prep.json`
- `neon-m3-production-final-post.json`
- `neon-m3-restore-postcheck.json`
- `program-deploy-m2-result.json`

## 开始 P5 前的硬 gate

1. 只读核对本交接、最新 P4 docs、live Render identity 与用户是否明确批准 H4。
2. 若 H4 未明确批准，停止并请求批准；不得写代码、创建 P5 mutation 或删除 restore branch。
3. H4 获批后，先从 canonical roadmap 提取 P5 的 exact scope、acceptance 与 mutation gates；不得从 P4 重跑验证，也不得自行打开任何 closed lane。

## 效率与审计规则

必须调用 `$state-delta-verification` skill。维护 evidence ledger，key 至少包含 `commit SHA + artifact/deploy ID + redacted env fingerprint + mutation id`：同 key 直接复用。

- docs-only：只做 `git diff --check`、protected-file/staging check、truth consistency。
- exact-SHA CI 已绿：不在本地重复全量套件；仅补 CI 未覆盖的风险。
- 每个 mutation：一次 consolidated preflight、一次 mutation、一次 consolidated postflight。
- subagents 只处理互斥 evidence gaps；禁止多人重复全仓 review。
- Fable 5 每阶段只审从上一个 accepted boundary 到 frozen candidate 的未覆盖连续 diff；有 blocker/major 时只审 verdict + fix-only closure，除非修复改变整体 threat model。
- 若进入 `commit -> deploy/gate fail -> fix -> commit` loop，立即使用 skill 的 fast-convergence 模式：保持 last-known-good，读取一次 exact error，最小修复，自我审计 + targeted proof；**不要每个 corrective commit 调 Claude/Fable**。形成稳定 candidate 后，只有阶段 gate 仍强制要求时才做一次 closure；纯 env/config 修正且 artifact 未变时不再外审。

模型分工：前端/README/docs 的计划性大改可交给 Opus 4.8；backend/Anchor/Prisma/CI 用 Codex；Fable 5 只做 P5/P6 阶段 release gate，不做实现或每 commit 审查。

## P5/P6 停止规则

P5：冻结 candidate → 风险对应测试与一次 browser/deployment smoke（仅在相关时）→ Fable 未覆盖 diff → 0 blocker/major → 停在 H5。

P6：只在 H5 明确批准后开始；同样冻结 candidate、最小验证和单次 Fable gate → 0 blocker/major → 停在 H6。

H6 也不等于真实资金或公开生产可用。External security audit 与 legal review 仍是任何 real-funds/public-launch promotion 的前置条件。不得自行进入下一阶段。
