# 执行 Prompt（第二轮）：修复 S1 Buyout 结算的完整性 / 活性 / 静默销户问题

> 用法：把 "PROMPT 开始 → PROMPT 结束" 之间整段交给 coding agent 执行。完成后把 `git diff` + 验证日志发回给我（本助手）复查。
> 前置：第一轮"打破比例性"的改动已合入工作区并通过测试（creator share + capped discovery reward + Track2 flat reward + 快照防 race）。本轮**只修三个遗留问题**，不要回退第一轮语义。

## 给你（用户）的背景（不要发给 coding agent）

本轮修复我复查第一轮代码时发现的三处问题：

- **#1（高·完整性）**：`execute_s1_graduation` 的持有人计数来自 executor 传入的 args，而该指令 permissionless，链上不验证计数真伪 → 可被操纵坑 backer。
- **#2（中·活性/租金）**：第一轮删掉了 `close_account`，offer USDC vault 永不关闭；若被计数的合格 backer 不来 claim，residual 永远扫不出去、租金永久锁定。
- **#3（中·静默销户）**：`claim_s1_buyout_usdc` 对"未被计数/不合格"的持有人发 0 并清零其 position，无报错。叠加 #1 会让真实合格者被无声归零。

下面 prompt 已为需要拍板的点给了默认值并标注"需人工确认"。

================== PROMPT 开始（整段交给 coding agent）==================

# 任务：修复 S1 buyout 结算的持有人计数完整性、vault 关闭/residual 活性、以及不合格领取的静默销户

你在 `StreamPump` 仓库工作。先读 `CLAUDE.md`、`docs/streamPump-long-term-roadmap.md`、`docs/protocol/spump-compliance-and-value-model.md`、`docs/protocol/s1-market-design.md`，并遵守其规则。本任务是在**第一轮"capped 非比例奖励"改动已存在**的基础上做修复，**不得回退**以下已实现语义：creator 拿 `s1_buyout_creator_share_bps`；backer 走 `calculate_s1_discovery_reward`（FlatEqual / EarlinessTiered / StatusPrimary，封顶、与 stake 解耦）；Track2 走 `calculate_flat_reward`；model/cap/residual 在 accept/settle 时快照。

## 0. 不可逾越的边界

1. 绝不让 USDC 奖励 ∝ stake；绝不改 SPUMP 非转让性；绝不改 program ID / 现有 PDA seeds（可新增账户/指令）。
2. 绝不部署 mainnet、绝不把就绪度标签升级为 `LIVE`、绝不把 seeded/preview 当生产。
3. git：只用显式 `git add <path>`，不碰受保护文件，不提交密钥，先不要 commit，留工作区待人工复查。
4. 财务语义/账户结构改动必须同步更新 Anchor + 后端测试，并补不开心路径测试。无测试覆盖视为未完成。
5. 改了任何账户结构体字段，必须同步更新其 `INIT_SPACE` 字节数，并在 `migrate_legacy_protocol_config`（或对应迁移）里处理 realloc 与默认值；否则旧账户会反序列化失败。

## 1. 当前真实符号（已核实，直接基于这些改）

- `programs/streampump-core/src/instructions/execute_s1_graduation.rs`：`ExecuteS1Graduation { executor: Signer (permissionless), ... }`；`ExecuteS1GraduationArgs { eligible_holder_count, early_holder_count, regular_holder_count }`；当前仅校验 `early+regular==eligible && eligible>0`（`InvalidHolderCountSnapshot`）。
- `programs/streampump-core/src/instructions/claim_s1_buyout_usdc.rs`：用 `counted_claimant` 判定是否计入；不合格时 `usdc_reward=0` 但仍执行 `position.internal_token_balance=0; early_cohort_balance=0; spump_cost_basis=0`（**问题 #3**）；residual 仅在 `eligible_holder_count==0` 时由"恰好最后一个 claimer"扫出；**无 `close_account`**（**问题 #2**）。
- `state.rs`：`S1BuyoutState` 含 `discovery_pool_usdc / discovery_pool_remaining / eligible_holder_count / early_holder_count / regular_holder_count(u32) / reward_model_snapshot / residual_to_snapshot / discovery_reward_cap_usdc_snapshot / status_thankyou_usdc_snapshot / discovery_min_hold_seconds_snapshot / creator_paid / rage_quit_deadline / bump`。`S1UserPosition { internal_token_balance, early_cohort_balance, first_bought_at, ... }`。`CreatorProfile { s1_supply, s1_early_cohort_supply, ... }`。
- offer vault seeds：`[b"offer_usdc_vault", buyout_offer.key()]`；buyout_offer signer seeds：`[b"buyout_offer", sponsor, creator, bump]`。
- `ProtocolConfig` 已有 `oracle_authority`、`admin`、`s1_rage_quit_window_seconds` 等。
- 错误枚举已有 `IneligibleForDiscoveryReward`、`InvalidHolderCountSnapshot`、`CreatorAlreadyPaid`、`InsufficientBuyoutUsdcLiquidity`、`InvalidResidualDestination`、`HoldDurationNotMet`、`MathOverflow`。

## 2. 修复 #1：持有人计数必须可信（分两阶段，两个都做）

目标：消除"executor 任意传计数即可操纵分配/坑 backer"的攻击面。

### Phase 1（立即、必做）—— 把 graduation 的计数来源限制为受信任方

- 在 `execute_s1_graduation` 增加约束：`require_keys_eq!(executor.key(), protocol_config.oracle_authority, Unauthorized)`（或新增 `admin` 二选一也可，但默认用 `oracle_authority`，与现有 Track2/S1-rating 的 oracle 信任模型一致）。保留现有 args 与 `early+regular==eligible && eligible>0` 校验。
- 这样计数至少来自协议受信任的 oracle，而非任意人。这是过渡期的安全护栏。

### Phase 2（目标、本轮也要做）—— 持有人计数改为链上自维护的真值源，丢弃 args

把"合格持有人数 / 早鸟数 / 普通数"做成**链上计数器**，在所有改变 `S1UserPosition` 余额的指令里增量维护，graduation 直接读取，不再信任外部输入。

**定义（务必一致）：**
- 某 position 是 **eligible holder** ⟺ `internal_token_balance > 0`。
- 是 **early** ⟺ `min(early_cohort_balance, internal_token_balance) > 0`，否则 **regular**。

**存放位置：** 在 `CreatorProfile` 上新增 `s1_eligible_holder_count: u32`、`s1_early_holder_count: u32`、`s1_regular_holder_count: u32`（更新 `CreatorProfile::INIT_SPACE` + 迁移默认 0）。

**维护点（找到所有写 `internal_token_balance` / `early_cohort_balance` 的地方）：** 至少 `buy_s1_token`、`sell_s1_token`、`rage_quit_s1`。在每次余额变更处，按"变更前 bucket → 变更后 bucket"做差分更新：
- 变更前 `pre_eligible = pre_balance>0`，`pre_early = min(pre_early_cohort, pre_balance)>0`；
- 变更后 `post_eligible`、`post_early` 同理；
- 若 `!pre_eligible && post_eligible`：`eligible++`，对应 bucket++（early 或 regular）。
- 若 `pre_eligible && !post_eligible`：`eligible--`，对应**变更前** bucket--。
- 若 `pre_eligible && post_eligible` 且 bucket 改变（regular→early 或 early→regular）：旧 bucket--、新 bucket++。
- 全部用 `checked_add/checked_sub`，下溢报新错误 `HolderCounterUnderflow`（防止 bug 把计数搞负后被静默饱和）。

**graduation 改造：**
- 删除 `ExecuteS1GraduationArgs`（或保留结构体但忽略，推荐直接删，更新 `lib.rs` 指令签名与所有调用方/IDL 使用方）。
- 从 `creator_profile` 读取三个计数器写入 `s1_buyout_state.eligible_holder_count/early/regular`，仍校验 `early+regular==eligible && eligible>0`。
- Phase 2 完成后，crank 是否恢复 permissionless 由人决定；**默认保留 Phase 1 的 oracle 约束**（双保险），并在文档注明"计数已链上可信，oracle 约束可在审计后放宽"。

**迁移/在途状态注意（重要，必须在 PR 说明里写明）：** 现有链上 `CreatorProfile` 的新计数器迁移后为 0，无法重建历史持有分布。因此：对**迁移前已存在的、尚未 graduation 的 buyout**，计数器不可信——这些只能走 Phase 1 的 oracle-args 路径，或由一次性 backfill 脚本（遍历链上 `S1UserPosition` 重算）回填。新创建的 S1 周期才享受 Phase 2 真值。把这点作为已知 blocker 记录，不要假装已解决。

## 3. 修复 #2：vault 关闭 + residual 活性（消除租金锁定与尾款死锁）

### 3a. 正常路径补回 close

- 在 `claim_s1_buyout_usdc` 末尾：当 `eligible_holder_count == 0 && discovery_pool_remaining == 0 && offer_usdc_vault.amount == 0` 时，用 buyout_offer PDA 签名 `token::close_account` 关闭 `offer_usdc_vault`，租金 `destination` 退给 **sponsor**（vault 是 sponsor 在 offer 阶段出资创建的；若原始 rent payer 不是 sponsor，请按实际 rent payer 退，并在 PR 说明里写明依据）。

### 3b. 新增带窗口的清扫指令 `sweep_s1_buyout_residual`

解决"被计数的合格 backer 一直不 claim → residual 与租金永久锁定"。

- 在 `S1BuyoutState` 新增 `graduated_at: i64`（在 `execute_s1_graduation` 写入 `now`；更新 INIT_SPACE + 迁移默认 0）。
- 在 `ProtocolConfig` 新增 `s1_discovery_claim_window_seconds: i64`（默认 `2_592_000` = 30 天；更新 INIT_SPACE + 迁移默认）。
- 新增指令 `sweep_s1_buyout_residual`：
  - 调用者：`oracle_authority` 或 `admin`（**不要 permissionless**，因为它跳过未 claim 者的领取权）。
  - 前置：`now >= graduated_at + s1_discovery_claim_window_seconds`（否则 `ClaimWindowStillOpen`）；`creator_paid == true`；防重入：要求尚未清扫（用 `discovery_pool_remaining > 0 || offer_usdc_vault.amount > 0` 作为可清扫条件，清扫后置 `discovery_pool_remaining = 0`、`eligible_holder_count/early/regular = 0`）。
  - 行为：把 `offer_usdc_vault` 剩余全额按 `residual_to_snapshot`（creator/sponsor）转出（账户约束同 claim 文件：`creator_usdc_ata.key()==creator_profile.payout_usdc_ata`、`sponsor_usdc_ata.owner==buyout_offer.sponsor`）；随后 `close_account` 关闭 vault、退租金给 sponsor；发新事件 `S1BuyoutResidualSwept { creator_profile, residual_amount, residual_to, swept_by, closed }`。
  - 窗口内仍允许正常 `claim_s1_buyout_usdc`；窗口外仍允许 claim（不强制），但清扫后 vault 已关，后续 claim 自然失败——这是预期；在文档写明"窗口后未领即作废"。
- 注册到 `lib.rs`，并在后端加对应 builder（见第 5 节）。

## 4. 修复 #3：不合格领取不得静默销户

在 `claim_s1_buyout_usdc` 里把两种情况严格区分：

- **不在计数集合内 / 不合格**（`counted_claimant == false`，含 `eligible_holder_count==0` 或对应 cohort 计数为 0 或未通过 min-hold）：**直接 `return err!(StreamPumpError::IneligibleForDiscoveryReward)`，不修改 position、不转账**。这样真实合格者不会因 #1 的坏计数被无声归零，重复/不合格调用也有明确错误。
  - min-hold 未满应继续用现有 `HoldDurationNotMet`（保持），不要并入上面的错误。
- **在计数集合内但奖励额为 0**（`counted_claimant == true` 且 `usdc_reward == 0`，例如 StatusPrimary 的 thankyou=0 或整除为 0）：这是**按策略合法的 0 奖励 finalize**——允许清零 position + 递减计数 + 发事件（`eligible=true, usdc_amount=0`）。这是唯一允许"0 额但销户"的路径。
- 保持"每个 position 只能成功 finalize 一次"（已 claimed 的再次调用应因 `internal_token_balance==0` 命中 `InsufficientInternalTokenBalance`，确认此路径仍然成立）。

## 5. 后端 / 前端 / 文档同步

- **Prisma**：`S1BuyoutProjection` 增 `graduatedAt`、`residualSweptAt`/`residualSwept`、`vaultClosed` 等字段；`CreatorMarketProjection`（或合适模型）增三个 holder 计数投影。生成新迁移文件（**只本地 dev apply，不要 apply 到生产 Neon**）。
- **indexer**：解析 `S1BuyoutResidualSwept` 与更新后的 `S1Graduated`/`S1BuyoutUsdcClaimed` 事件字段；维护计数投影。
- **AnchorService / builders**：graduation builder 去掉 args（Phase 2）或改为从受信任来源取数（Phase 1 过渡）；新增 `sweep_s1_buyout_residual` builder（仅 oracle/admin 可调）。
- **s1ActionController / 路由**：暴露 sweep 的受限入口（带权限校验），就绪度标签保持现状（不升级 LIVE）。
- **前端**：buyout/portfolio 页区分"可领 / 不合格（明确原因）/ 窗口已过作废 / 已清扫"状态；文案继续遵守禁用词规则（无 investment/ROI/yield/pro-rata）。
- **文档**：更新 `s1-market-design.md`（计数器语义、claim 窗口、sweep、residual/close 规则）；在 `spump-compliance-and-value-model.md` 与 roadmap ledger 追加一行（写明本轮修了 #1/#2/#3、验证命令与结果、仍存在的 blocker：计数器对迁移前在途 buyout 不可信、需 backfill；以及法律/审计等既有 blocker）。**不得**升级就绪度。

## 6. 必须新增/改写的测试（缺一不可，贴真实输出）

**Anchor：**
- #1 计数器完整性：first-buy 使 eligible++ 且落入正确 bucket；再次 buy 不重复计数；partial sell 不减、full sell/rage-quit 使 eligible-- 且减正确 bucket；regular↔early 迁移时计数器正确搬移；下溢被 `HolderCounterUnderflow` 拦截。
- #1 graduation：读取链上计数器值正确；非 oracle 调 graduation（Phase 1）被 `Unauthorized` 拒；`eligible==0` 被拒。
- #2 sweep：窗口未到调用被 `ClaimWindowStillOpen` 拒；非 oracle/admin 调用被拒；窗口后 sweep 把 residual 按快照转对、关闭 vault、退租金、发事件；重复 sweep 被拒；窗口内正常 claim 仍可领。
- #2 正常 close：所有合格者领完后 vault 被关、租金退回。
- #3：不合格/重复领取者被 `IneligibleForDiscoveryReward` 拒且 **position 未被清零**（断言 `internal_token_balance` 不变）；合格但 0 额者可正常 finalize 并清零。
- **回归**：第一轮的 `s1-happy-path`（两早鸟等额、residual 流向、creator 80%）与 `s2-traffic-market`（不等 stake 等额封顶）必须仍通过。

**后端：** 计数投影、graduation/sweep 投影、builder 权限校验相关 spec。

## 7. 验证（逐步执行并贴真实日志）

- `cargo check`；`npm run build:anchor`；`scripts/test-anchor-local.sh` 跑 `s1-happy-path`、`s1-buyout`、`s1-buyout-unhappy-path`、`s1-guards`、`s2-traffic-market`、`s2-unhappy-path`；`npm run test:chain:local`。
- `npx prisma generate`（在 backend/）；`npm run build --prefix backend`；`npm run test:backend`。
- `npm run build --prefix app`。
- `git diff --check`；确认受保护文件未 staged；新迁移未 apply 到生产。

## 8. 交付物

1. 按文件的 `git diff`。
2. 第 7 节全部命令的真实输出（贴日志，不要只说"通过"）。
3. 一段数值示例：展示"恶意/错误计数"在新方案下已无法坑 backer（对比 Phase 1 oracle 约束前后、或 Phase 2 链上计数前后）。
4. 仍未解决的人工 blocker 清单（迁移前在途 buyout 的计数 backfill、法律 token 分类、辖区/KYC、Anchor 审计、生产迁移批准、程序部署、devnet 钱包级 smoke）。
5. 用默认值但需人工确认的清单：oracle vs admin 作为 graduation/sweep 调用者、`s1_discovery_claim_window_seconds=30天`、residual/租金退回对象、是否在 Phase 2 后恢复 permissionless crank。
6. 不得声称合规达成或可上线。

## 9. 若被阻塞

需要人工决策处，用本 prompt 默认值继续并显著标注"待确认"。遇到边界类阻塞（生产部署/密钥/生产迁移/需要真实法律意见）则停止并报告。

================== PROMPT 结束 ==================

---

## 我复查第二轮时会重点检查

1. **#1**：graduation 是否加了 oracle 约束（Phase 1）；是否新增链上计数器并在 buy/sell/rage-quit 三处正确差分维护、含 regular↔early 迁移与下溢保护（Phase 2）；graduation 是否改读计数器/丢弃 args；迁移前在途 buyout 的处理是否如实写成 blocker。
2. **#2**：是否有 `graduated_at` + claim 窗口 + 受限 `sweep_s1_buyout_residual`；正常路径是否补回 `close_account`；租金退回对象是否正确；是否有"窗口前 sweep / 重复 sweep / 非授权 sweep"测试。
3. **#3**：不合格路径是否改为**报错且不清零 position**（必须有断言 position 未变的测试）；合格但 0 额是否仍能 finalize。
4. 账户结构改动是否同步了 `INIT_SPACE` 与迁移默认值（`CreatorProfile`、`S1BuyoutState`、`ProtocolConfig` 都新增了字段）。
5. 回归：第一轮非比例性测试仍全过；program ID/seeds 未动；无 LIVE 升级；禁用词无回潮；验证日志真实。
