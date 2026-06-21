# 执行 Prompt：S1 Buyout / S2 Endorsement 结算重设计（打破 Howey 比例性）

> 用法：把下面"PROMPT 开始 → PROMPT 结束"之间的全部内容整段交给 coding agent 执行。
> 完成后把它产出的 diff / 验证日志发回给我（本助手）复查。
> 本文件本身不是代码改动；它是一份给执行 agent 的规格说明。

---

## 给你（用户）的背景说明（不要发给 coding agent，仅供你理解）

- **目标**：把当前"按出资比例（pro-rata）分 USDC"的结算，改成"封顶 + 与 stake 解耦 + 平台/赞助出资的发现奖励"，从而削弱证券（Howey）属性、塌缩 SPUMP 隐含价格。设计依据是 `docs/protocol/spump-compliance-and-value-model.md`。
- **当前真实代码状态（已核实）**：
  - `execute_s1_graduation` 把**全部** `usdc_deposited` 放进 `claimable_usdc_remaining`（early/regular 两档），创作者只拿 50% 虚拟 SPUMP 奖金、**拿不到 USDC**；`claim_s1_buyout_usdc` 严格按 `internal_token_balance` 比例发 USDC。→ 纯投资回报结构。
  - `settle_track2` 把达成预算的 20% 留作粉丝池；`claim_endorsement` 按 `staked_amount` 比例发。→ 同样是比例回报。
- **三个需要人来拍板的决策**（我已在 prompt 里给出可执行默认值 + 设为链上可配置，但最终要法律确认）：① buyout 奖励用 A/B/C 哪种模型；② 各项 per-user USDC 封顶值与发现池大小/出资方；③ S1 "unbacking" 是否还返还 SPUMP。
- **硬边界**：这是 audit-sensitive 的财务语义改动。按仓库规则，**不得**部署到 mainnet、不得对真实公众资金开放、不得把就绪度标签改成 LIVE。法律意见 + Anchor 审计是 prompt 之外的人工阻塞项。

---

================== PROMPT 开始（整段交给 coding agent）==================

# 任务：重设计 StreamPump 的 S1 Buyout 与 S2 Endorsement 结算，打破 stake↔USDC 比例性

你在 `StreamPump` 仓库工作（Solana/Anchor 程序 + Express/Prisma 后端 + Next.js 前端）。在开始前，**必须**先阅读以下文件并遵守其规则：`CLAUDE.md`、`docs/streamPump-long-term-roadmap.md`、`docs/protocol/spump-compliance-and-value-model.md`、`docs/protocol/s1-market-design.md`、`docs/protocol/fan-loyalty-and-spump-economy.md`。

## 0. 不可逾越的边界（先读，违反即视为失败）

1. **绝不**让任何"用户出资额 / stake 大小"直接、按比例地决定其 USDC 领取额。新模型里 backer/endorser 的 USDC 奖励必须 **(a) 有硬性 per-user 封顶；(b) 与 stake 大小解耦**（允许依"早期程度 / 忠诚档位 / 是否合格"分配，但不得 ∝ stake）。
2. **绝不**改变 SPUMP 的非转让性，**绝不**让 SPUMP 可上 DEX/CEX，**绝不**改 program ID / PDA seeds（除非本任务明确要求新增 PDA）。
3. **绝不**部署到 mainnet、**绝不**把任何就绪度标签从当前值升级为 `LIVE`、**绝不**把 seeded/preview 当作生产行为。所有新行为默认通过配置/flag 关闭或标注为 `NOT_STARTED`/`MOCK_PREVIEW` 直至人工放行。
4. 遵守 git 规则：只用显式 `git add <path>`，不碰受保护文件（`backend/package-lock.json`、`pitch/colosseum-submission.md`、`pitch/demo-youtube-description.md`），不提交密钥，不 `git add .`。**先不要 commit**，把改动留在工作区供人工复查（除非用户另行要求）。
5. 这是 audit-sensitive 的财务语义改动：**每改一处结算数学，必须同步更新对应的 Anchor / 后端测试**，并新增不开心路径测试。没有测试覆盖的结算改动视为未完成。

## 1. 设计目标（要实现的最终经济语义）

### 1.1 S1 Buyout（最高优先级）

把"buyout USDC 全额按比例分给 backer"改成：

- **创作者拿大头**：buyout 的 USDC 主要作为创作者的商业变现收入，按可配置比例 `s1_buyout_creator_share_bps`（默认 `8000` = 80%）支付给创作者。
- **发现奖励池（capped, 解耦）**：剩余部分（默认 20%，即 `10000 - creator_share`）进入一个 **backer 发现奖励池**，按下面选定的"非比例"模型分配，且每用户封顶 `s1_discovery_reward_cap_usdc`。
- **分配模型设为链上枚举**，让法律可在 A/B/C 间切换而无需改逻辑分支结构：
  - `enum S1BuyoutRewardModel { FlatEqual, EarlinessTiered, StatusPrimary }`
  - **默认 `EarlinessTiered`**：合格 backer（`internal_token_balance > 0` 且满足最低持有时长 `s1_discovery_min_hold_seconds`，默认 0 先不启用时长门槛）按"是否属于 early cohort"分两档定额领取——early 档每人定额 `early_unit`，regular 档每人定额 `regular_unit`，`early_unit`/`regular_unit` 由池子总额按两档**人数**（非 stake）均分得到，并对每人取 `min(unit, cap)`。**关键：分配只依赖人数与档位，绝不乘以 `internal_token_balance`。**
  - `FlatEqual`：所有合格 backer 平均分（忽略 early/regular），每人 `min(pool/holders, cap)`。
  - `StatusPrimary`：发现池 USDC 极小或为 0，backer 主要获得"创始支持者"永久身份（链下/链上 flag），USDC 只发一笔可配置的小额 `s1_status_thankyou_usdc`。
- **池子余额处理**：因为封顶 + 解耦，可能有 USDC 发不完。未分配的余额按 `s1_buyout_residual_to` 配置流向：默认 `Creator`（并入创作者收入），可选 `Sponsor`（退还中标赞助商）。**绝不**把残值再按比例二次分给 backer（那会把比例性偷偷加回来）。
- **"合格 backer 人数"如何上链**：当前 `S1BuyoutState` 没有 holder 计数。新增 `eligible_holder_count` / `early_holder_count` / `regular_holder_count` 字段，在 `execute_s1_graduation` 时由 indexer 提供的快照写入，或改为"每个 backer 首次 claim 时按定额扣减池子并递减计数"。**推荐后者**（见 1.3 的实现要点），避免依赖外部计数的信任问题。

### 1.2 S2 Track2 Endorsement（次优先级，同一原则）

- 保留"endorsement 是有成本的支持信号"（SPUMP burn 不变）。
- 把粉丝池 USDC 奖励从"按 `staked_amount` 比例"改成 **per-user 封顶 + 与 stake 解耦**：默认采用 `FlatEqual`——成功活动里每个合格 endorser 领 `min(fan_pool / endorser_count, track2_reward_cap_usdc)`；失败/取消/过期路径维持现状（失败 100% SPUMP 退、取消 5% slash、过期 100% 退——这些是本金返还，不是收益，保留）。
- 残值同样不得按比例二次分配；未发完的粉丝池余额按 `track2_residual_to`（默认 `Sponsor` 退款）处理。
- 可选增强（如时间允许）：把部分粉丝奖励改为非 USDC 的 badge XP / 身份（接 `fan-loyalty-and-spump-economy.md`），进一步降低货币化比例。先用 flag `track2_noncash_reward_enabled` 关闭。

### 1.3 SPUMP "unbacking" 措辞与 sell 语义（低优先级，先不动数学）

- **本轮不改 `sell_s1_token` 的退款数学**（避免牵动曲线经济学与一大批测试）。只在**代码注释、事件名/文档/前端文案**层面把 sell 重定性为 "unbacking"，并在文档中记录"未来是否改为全消耗（不退 SPUMP）"为开放决策。任何数学改动留到单独任务 + 法律确认。

## 2. 具体落地改动清单（按文件）

> 先 `git branch --show-current` 确认在 `codex/post-deadline-phase-0`；`git status --short` 确认工作区干净。每完成一个子项就跑一次最小验证（见第 3 节），不要一次性堆改动。

### A. 链上：`programs/streampump-core/`

1. **`state.rs`**
   - `ProtocolConfig` 新增可配置参数（全部带默认值，向后兼容；若改了账户大小，必须提供 `migrate_legacy_protocol_config` 路径或确认 realloc 策略）：
     - `s1_buyout_creator_share_bps: u16`（默认 8000）
     - `s1_buyout_reward_model: u8`（映射上面的枚举，默认 = EarlinessTiered）
     - `s1_discovery_reward_cap_usdc: u64`
     - `s1_status_thankyou_usdc: u64`
     - `s1_buyout_residual_to: u8`（0=Creator,1=Sponsor）
     - `s1_discovery_min_hold_seconds: i64`（默认 0）
     - `track2_reward_cap_usdc: u64`
     - `track2_residual_to: u8`
   - `S1BuyoutState` 新增：`creator_payout_usdc`、`discovery_pool_usdc`、`discovery_pool_remaining`、`eligible_holder_count`/`early_holder_count`/`regular_holder_count`（按 1.1 选定方案）、`reward_model_snapshot: u8`、`creator_paid: bool`。
   - 在文件顶部为每个新字段写明用途注释；更新对应的 `LEN`/`INIT_SPACE`（若手动维护 size，务必同步，否则账户反序列化会崩）。

2. **`initialize_protocol.rs` / `migrate_legacy_protocol_config.rs`**
   - 写入/迁移上述新 ProtocolConfig 字段的默认值；为旧账户提供安全迁移（默认值要让"行为接近旧逻辑但封顶生效"，避免迁移瞬间语义跳变；如无法兼容，明确在 PR 说明里写出"必须先迁移再升级程序"）。

3. **`accept_buyout_offer.rs`**
   - 维持 `winning_sponsor` / `usdc_deposited` / `rage_quit_deadline` 写入；快照 `reward_model_snapshot = protocol_config.s1_buyout_reward_model`，使后续 claim 不受中途配置变更影响（防 race / 治理攻击）。

4. **`execute_s1_graduation.rs`（核心改动）**
   - 计算 `creator_payout_usdc = amount_from_bps(usdc_deposited, s1_buyout_creator_share_bps)`，`discovery_pool_usdc = usdc_deposited - creator_payout_usdc`。
   - **新增创作者 USDC 支付**：从 `offer_usdc_vault`（由 `buyout_offer` PDA 托管，签名 seeds 见 `claim_s1_buyout_usdc`）转 `creator_payout_usdc` 到 `creator_profile.payout_usdc_ata`。需要在账户结构里加入 `offer_usdc_vault`、`buyout_offer`、`creator_usdc_ata`、`usdc_mint`、`token_program`（参考 `claim_s1_buyout_usdc` 的账户写法与 signer seeds）。
   - 设置 `discovery_pool_remaining = discovery_pool_usdc`；**不再**把 `usdc_deposited` 整额写进 `claimable_usdc_remaining`。保留/重命名 early/regular supply 计数仅用于"档位判定"，不再用于按比例分钱。
   - `creator_paid = true`；更新 `S1Graduated` 事件，新增 `creator_payout_usdc`、`discovery_pool_usdc`、`reward_model_snapshot` 等字段。
   - 维持现有的 50% 虚拟 SPUMP 毕业奖金逻辑不变（那是 SPUMP，不是 USDC，不触发 Howey；但在文档里记录其与新模型的关系）。

5. **`claim_s1_buyout_usdc.rs`（核心改动）**
   - 重写为"非比例发现奖励领取"：
     - 校验 `position.internal_token_balance > 0`（合格）+ 可选持有时长门槛。
     - 按 `reward_model_snapshot` 计算该用户**定额**奖励（`FlatEqual`/`EarlinessTiered`/`StatusPrimary`），对 `min(unit, cap)` 取值；**严禁**任何 `* internal_token_balance` 的比例式。
     - 从 `discovery_pool_remaining` 扣减实际发放额，递减对应 holder 计数；池子发完后多余 backer 领到 0（合法，需有清晰错误/事件而非 panic）。
     - 维持"每个 position 仅可领一次"（清零 balance / 置 claimed）。
     - 处理残值：当最后一名合格 backer 领完或满足结束条件，按 `s1_buyout_residual_to` 把 `discovery_pool_remaining` 转给 creator 或 sponsor，并在合适时机 close vault。
   - 更新 `S1BuyoutUsdcClaimed` 事件字段（去掉会暗示比例的字段，加入 `reward_model`、`capped`、`pool_remaining`）。
   - 重命名建议：把面向用户的语义从 "claim buyout share" 调整为 "claim discovery reward"（注释 + 事件 + 文档；指令名可保留以免破坏 IDL/seeds，但在注释里说明）。

6. **`settle_track2.rs` + `claim_endorsement.rs`**
   - `settle_track2`：粉丝池金额计算可保留（达成预算的 20%），但记录 `track2_endorser_count` 与 `reward_model`/cap 快照，供 claim 用定额而非比例。
   - `claim_endorsement` 成功路径：把 `usdc_reward = staked * fan_pool / total_staked` 改为 `min(fan_pool / endorser_count, track2_reward_cap_usdc)`（或选定的解耦模型）；保留 last-claimer dust 兜底但不得变成比例分配；残值按 `track2_residual_to` 处理。失败/取消/过期路径**不变**。
   - 更新 `Track2Settled` / `EndorsementSettled` 事件。

7. **`errors.rs`**
   - 新增：`DiscoveryPoolExhausted`、`RewardCapZero`、`IneligibleForDiscoveryReward`、`InvalidRewardModel`、`HoldDurationNotMet`、`CreatorAlreadyPaid` 等所需变体。

8. **`events.rs`** —— 按上面各事件改动同步。

### B. 后端：`backend/`

1. **Prisma `schema.prisma`**：在 `S1BuyoutProjection` / `S1PositionProjection` / `S2EndorsementPositionProjection` / `CreatorMarketProjection` 上新增对应投影字段（creator payout、discovery pool、remaining、reward model、capped reward、per-position 是否已领、是否合格）。新增迁移文件（不要自动 apply 到生产 Neon——只生成迁移 + 本地 dev apply；生产迁移需人工批准，见边界 3）。
2. **`indexer.ts`**：解析新事件字段，写入投影。
3. **`marketProjectionService.ts` / `chainProjectionService.ts`**：把"可领金额"从比例公式改为新定额模型的只读估算，确保前端显示与链上一致（同一公式来源）。
4. **S1/endorsement 交易 builder（`s1Routes`/`proposal` 相关 service）**：如指令账户结构变化（如 graduation 新增账户），同步 builder 与 PDA 派生。
5. 保持 API 返回的就绪度标签为现状（不升级为 LIVE）。

### C. 前端：`app/`（最小改动 + 文案纪律）

1. 把任何"按你的份额领取 USDC / 你的投资回报"类文案改为"发现奖励 / 早期支持者奖励 / 平台返还（capped）"。**禁用词**：investment / ROI / yield / APY / returns / 被动收入 / SPUMP 价格。参考 `spump-compliance-and-value-model.md` Layer 4。
2. portfolio / buyout / endorse / rewards 页：展示"封顶后的可领额 + 是否合格 + 池子剩余"，并保留就绪度/来源标签。
3. 不得静默用本地 mock 冒充生产数据。

### D. 文档：`docs/`

1. 更新 `s1-market-design.md`：写明新参数、buyout 分配模型、封顶、残值流向。
2. 更新 `spump-compliance-and-value-model.md`：把相关条目从 `NOT_STARTED`（设计）推进为"已实现于代码、待法律+审计放行"的准确状态——**不得**写成已合规/已上线。
3. 在 `streamPump-long-term-roadmap.md` 的 Progress Ledger 追加一行：日期、scope、改了什么、验证命令与结果、仍存在的 blocker（法律意见 / Anchor 审计 / 生产迁移批准 / 程序部署 / 钱包级 devnet smoke）。

## 3. 验证（最小命令集，必须执行并贴出结果）

按改动类型逐步验证，不要只在最后跑一次：

- 链上：`cargo check`；`npm run build:anchor`；相关 Anchor 测试 `scripts/test-anchor-local.sh programs/tests/s1-buyout.spec.ts`、`s1-buyout-unhappy-path.spec.ts`、`s2-traffic-market.spec.ts`，以及 `npm run test:chain:local`。
- 后端：`npx prisma generate`（在 `backend/`）；`npm run build --prefix backend`；`npm run test:backend`（至少 `s1MarketProjection*`、`s2EndorsementProjection`、`marketProjectionService` 相关 spec）。
- 前端：`npm run build --prefix app`。
- 通用：`git diff --check`；确认受保护文件未被 staged。

### 必须新增/改写的测试（缺一不可）

- S1 buyout：**断言任意两个 stake 不同但同档位/同合格性的 backer，拿到的 USDC 相等或同被 cap 限制**（即"非比例"性质被测试钉死）；creator 收到 `creator_share_bps` 的 USDC；池子发完后多余 backer 领 0；残值按配置流向正确；double-claim 被拒。
- Track2：成功路径 endorser 奖励为定额且被 cap 限制、与 stake 解耦；失败/取消/过期路径本金返还行为不回归。
- 迁移：旧 ProtocolConfig 迁移后新字段为预期默认值，且旧流程不 panic。

## 4. 完成后的交付物

1. 全部改动的 `git diff`（按文件）。
2. 第 3 节所有验证命令的真实输出（贴日志，不要只说"通过"）。
3. 一段"语义变更说明"：用一个具体数字例子展示旧 vs 新（例如：buyout `usdc_deposited = 10,000 USDC`，3 个 backer 持仓 100/300/600，旧逻辑各得 1000/3000/6000；新逻辑 creator 得 8000，发现池 2000 按 EarlinessTiered 定额封顶分配，给出每人实际所得）。
4. 明确列出**仍未解决的人工 blocker**：法律 token 分类意见、首发辖区/KYC、Anchor 审计、生产迁移批准、程序部署、钱包级 devnet smoke。
5. **不要**声称合规已达成或可上线；只声称"代码层面已实现解耦+封顶语义，待人工门控"。

## 5. 若被阻塞

若遇到需要人工决策的点（A/B/C 模型选择、cap 具体数值、残值流向、账户 realloc 是否可接受），**不要臆造**：选用本 prompt 给出的默认值继续实现，并在交付物里用显著标记列出"已用默认值、需人工确认"的清单。遇到第 0 节边界类阻塞（生产部署/密钥/生产迁移）则停止并报告。

================== PROMPT 结束 ==================

---

## 复查时我（本助手）会检查什么（供你心里有数）

1. **比例性是否真被打破**：搜 `claim_s1_buyout_usdc` / `claim_endorsement` 里有没有残留 `* internal_token_balance` / `* staked_amount` 的 USDC 计算；有没有对应的"等额/封顶"测试钉死。
2. **创作者是否真的拿到 USDC**：graduation 是否新增了向 creator payout ATA 的转账，金额 = `creator_share_bps`。
3. **封顶与残值**：cap 是否生效、残值是否被错误地二次按比例分给 backer。
4. **快照防 race**：reward model / cap 是否在 accept/settle 时快照，避免治理中途改参影响在途 claim。
5. **账户 size / 迁移**：新增字段是否同步了账户空间与迁移路径，旧账户会不会反序列化失败。
6. **就绪度纪律**：有没有偷偷把标签升级为 LIVE、有没有动 program ID/seeds、文案禁用词是否清除、blocker 是否如实保留。
7. **验证证据**：是否贴了真实的 build/test 输出，而不是口头"通过"。
