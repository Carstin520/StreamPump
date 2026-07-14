<p align="center">
  <h1 align="center">🎬 StreamPump</h1>
  <p align="center">
    <strong>面向创作者赞助的 Web2.5 信任层——把内容创作、创作者势能、粉丝参与和赞助预算，放进同一个产品闭环，并在 Solana 上结算。</strong>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Built_on-Solana-de402a?style=for-the-badge&logo=solana&logoColor=white&labelColor=0a1018" alt="Solana">
    <img src="https://img.shields.io/badge/Anchor-0.32-1b2740?style=for-the-badge&labelColor=0a1018" alt="Anchor">
    <img src="https://img.shields.io/badge/Next.js-15-1b2740?style=for-the-badge&logo=nextdotjs&logoColor=white&labelColor=0a1018" alt="Next.js">
    <img src="https://img.shields.io/badge/TypeScript-5-1b2740?style=for-the-badge&logo=typescript&logoColor=white&labelColor=0a1018" alt="TypeScript">
    <img src="https://img.shields.io/github/last-commit/Carstin520/StreamPump?style=for-the-badge&label=Last+Commit&color=de402a&labelColor=0a1018" alt="Last Commit">
  </p>
  <p align="center">
    <a href="README.md">🇬🇧 English README</a>
  </p>
  <img src="docs/readme-assets/ui-explore-feed-zh.png" alt="StreamPump 创作者发现界面" width="100%">
</p>

---

## 📋 目录

- [这是什么？](#-这是什么)
- [StreamPump 凭什么不一样](#-streampump-凭什么不一样)
- [核心能力](#-核心能力)
- [界面预览](#-界面预览)
- [产品模型](#-产品模型)
- [工作原理](#-工作原理)
- [为什么选择 Solana](#-为什么选择-solana)
- [当前状态](#-当前状态)
- [仓库结构](#-仓库结构)
- [本地启动](#-本地启动)
- [技术栈](#-技术栈)
- [Demo 路径](#-demo-路径)
- [测试](#-测试)
- [部署](#-部署)
- [路线图](#-路线图)
- [文档索引](#-文档索引)
- [安全与 Git](#-安全与-git)
- [许可](#-许可)

---

## ✨ 这是什么？

**StreamPump** 是一个构建在 Solana 上的 Web2.5 创作者赞助市场。它把内容创作、创作者势能、赞助预算、粉丝参与和链上结算放进同一个产品闭环。

它**不是** fan token 赌场，**不是**传统 influencer CRM，也**不是** view-to-earn 刷量农场。它是三方之间缺失的那一层——**信任层**：

- **创作者**：先从粉丝处获得冷启动资金，再毕业进入结构化赞助，既有保底报酬，也有表现激励。
- **粉丝 / 支持者**：用非转让的 `SPUMP` 早期支持创作者；当你 back 的创作者毕业时，获得永久创始身份，外加一份**有上限、由赞助方出资的发现奖励**——而不是按持仓比例的回报，也不是二级市场投机。
- **赞助方**：无需中介代理，直接触达创作者，通过三条灵活的 USDC 预算轨道投放，并拿到可验证的链上活动凭证。

```text
内容 → 创作者势能 → 粉丝参与 → 赞助方 USDC 预算 → Solana 结算
```

> **设计原则：** 产品流程 DB-first，资金事实 chain-first。草稿、上传、内容清单、proposal intent 都在 Postgres 里流转；出资、结算、token 流动以 Solana 为最终事实。

---

## 🔥 StreamPump 凭什么不一样

创作者经济预计到 **2027 年达到 4800 亿美元**（高盛），美国创作者广告支出已达 **370 亿美元**（IAB 2025），且 **73%** 的品牌现在更偏好与中腰部创作者合作而非头部网红。需求已经存在——**缺的是信任层。**

Web3 试图切入这个市场，但大多失败了，而且是结构性失败：

| 项目 | 发生了什么 |
|---|---|
| **Friend.tech** | 日活约 8 万 → **不足 1 万**；收入崩到 **71 美元**；团队弃用合约 |
| **Farcaster** | 融资 **1.5 亿美元**；新注册从 **1.5 万/月 跌到 545/月** |
| **Lens Protocol** | 新用户从 **3.7 万/月 跌到 142/月**——暴跌 **99.6%** |

三个结构性问题害死了它们：**token 优先而非产品优先**、**view-to-earn 死亡螺旋**（赚 token → DEX 抛售 → 价格崩盘 → 用户流失）、以及**没人真正想要的"虚假内容所有权"**。

StreamPump 建立在四个核心信念之上，正好规避了上述每一个陷阱：

| 信念 | 含义 |
|---|---|
| 🎥 **内容才是资产** | 视频和帖子能长期留住受众——meme 币和 NFT 只吸引投机者。我们不主张拥有、也不把内容代币化；链上只存一条创作者签名的发布时间戳 + 归属记录用于分配收益，内容仍留在创作者自己的平台上 |
| 🔒 **`SPUMP` 仅作工具** | 非转让的 Token-2022；永不上 DEX/CEX。backing 是**用时间和注意力计价、而非用钱**的 skin in the game——不可转让正是让它成为可信信念信号的机制，而非妥协 |
| 💼 **赞助方是营销支出方** | 投放的是活动预算而非投机资本——这是更健康的资金来源 |
| ⚙️ **天然自动化** | 不靠臃肿团队或榨取式 tokenomics；靠服务费 + 小额 USDC 交易费维持运转 |

---

## 🎯 核心能力

| 能力 | 说明 |
|---|---|
| 🚀 **S1 创作者发现** | 粉丝 burn `SPUMP` 进入按评级调整的 bonding-curve 头寸，早期支持创作者 |
| 🤝 **S1 → S2 买断桥接** | 赞助方出 USDC 买断创作者；创作者拿大头，持有者可 rage-quit 退出，或在毕业时领取一份有上限、与持仓解耦的发现奖励 |
| 📊 **三轨赞助** | 固定保底、表现预算、延迟 CPS——每条轨道独立链上结算 |
| 🗳️ **粉丝背书池** | 粉丝 burn `SPUMP` 背书活动，从 Track 2 表现池赚取一份有上限的统一（非按持仓比例）USDC 奖励 |
| 🔗 **可验证活动凭证** | 每个活动都暴露其 PDA、交易签名、manifest hash 和内容锚定 |
| 👛 **Web2.5 托管钱包** | 邮箱/社交登录用户获得平台代管钱包——后端签名并代付，全程零 SOL |
| 🛡️ **反投机护栏** | 非转让 token、每日买入上限、动态退出税、延迟评级、背书上限 |
| 🎞️ **真实媒体管线** | Cloudflare R2 存储 + Mux 视频处理 + 进入公开 feed 前的发布验证 |

> **边界——以上是协议/代码能力，不代表当前 Pilot 的可用性。** 已部署的受控技术 Pilot 仅运行在 devnet/test-USDC 上，保持邀请制，**不是公开生产上线且无真实资金**。对 Pilot 用户唯一开放的通道是：外部钱包认证 → 媒体 → feed → proposal intent → 创作者 + 赞助方双签 → 后端 relay → 手动 Track 1 → 活动凭证。S1 发现/买断、粉丝背书池、Track 2/3 结算、以及 email/social 托管钱包在代码中存在，但**对所有 Pilot 用户关闭**（见[当前状态](#-当前状态)）。

---

## 📸 界面预览

| 热门创作者 | S1 创作者市场 |
|---|---|
| ![Trending](docs/readme-assets/ui-trending-creators-zh.png) | ![S1 Market](docs/readme-assets/ui-s1-market-zh.png) |

| 投资组合与领取 | 活动链上凭证 |
|---|---|
| ![Portfolio](docs/readme-assets/ui-portfolio-claim-zh.png) | ![Campaign](docs/readme-assets/ui-campaign-detail-zh.png) |

---

## 🧩 产品模型

StreamPump 有两个相互衔接的产品层。

### S1——创作者发现市场

S1 是创作者进入赞助市场前的发现层。粉丝 burn `SPUMP`（非转让 Token-2022），获得记录在 `S1UserPosition` 里的**内部创作者头寸**（以 PDA 形式存储，**不是**可交易的 SPL token）。价格沿二次 bonding curve 移动，并由 oracle 评估的 momentum 评级缩放：

```text
effective_k = base_k * creator_rating_bps / 10_000
buy cost    = effective_k / 2 * ((S + dS)^2 - S^2)
sell return = effective_k / 2 * (S^2 - (S - dS)^2)
```

默认评级为 `10_000`（1.0×），区间 `5_000`–`20_000`（0.5×–2.0×），带每日变动上限和延迟生效。当创作者达到临界规模，赞助方提交**买断报价**；创作者接受并经过 rage-quit 窗口后，执行**毕业**——创作者拿到买断 USDC 的大头，剩余持有者领取一份**有上限、非按比例的发现奖励**（按资格 / 早期程度 / 忠诚度，绝不随 staked SPUMP 缩放）。

> 参数与反套利护栏详见 [docs/protocol/s1-market-design.md](docs/protocol/s1-market-design.md)。

### S2——赞助活动市场

赞助方通过三条预算轨道为活动出资：

| 轨道 | 模式 | 结算 |
|---|---|---|
| **Track 1** | 固定保底 | 无条件支付给创作者 |
| **Track 2** | 表现预算 | 达到 cliff 阈值后，80% 给创作者 / 20% 进粉丝背书池 |
| **Track 3** | CPS（按销售付费） | 退款窗口关闭后延迟结算 |

发起流程在资金移动前 DB-first，资金移动时 chain-first：

```text
钱包会话
  → 内容 manifest
  → proposal intent
  → 创作者部分签名
  → 赞助方最终签名
  → Solana proposal + 注资 vault
  → 分轨结算
```

### 忠诚度与粉丝牌（设计）

> 🧭 **设计 / 规划中——尚未实现。** 规范见 [docs/protocol/fan-loyalty-and-spump-economy.md](docs/protocol/fan-loyalty-and-spump-economy.md)。

在 S1/S2 之上叠加一个忠诚度层，把"早期粉丝"身份做成具体可见的东西，并为 `SPUMP` 提供随时可用的消耗汇。每个粉丝对每个创作者持有一枚**灵魂绑定的粉丝牌**，按关注时长加互动升级，早期 cohort 支持者获得永久的**创始粉 #N** 排名。`SPUMP` 被定位为信念/声音——而非钱——因此不可转让是优点：正因为它只能靠时间赚取，花掉它才是真实信念的可信信号。粉丝牌升级、打赏（cheer）、内容助推（boost）和功能解锁都会 burn `SPUMP`，让它的用处不再取决于"当下有没有值得 back 的创作者"；同时每个创作者的 S1 每日上限随粉丝牌等级缩放，让忠诚度（而非资金量）赢得 backing 优先权。

### 平台等级与星探影响力（设计）

> 🧭 **设计 / 规划中——Phase 1 只读骨架已落地（MOCK_PREVIEW）。** 规范见 [docs/protocol/user-influence-and-leveling.md](docs/protocol/user-influence-and-leveling.md)。

用户拥有两个维度的身份：**等级（Lv0–Lv6）**——B 站式的资历/信任进度，以及在你早期发现的创作者真的成长后才赚到的**星探称号徽章**（路人 → 观察者 → 星探 → 金牌伯乐）。表层只展示**一个主数字（等级）+ 一个靠结果赚来的称号（星探）**——不会出现两条竞争的经验条。

高身份用户的点赞、打赏、背书会分配**更多发现流量**、对创作者动量贡献更大。关键在于——影响力是**声望/发现货币，而非金融货币**：加权可以自由地推动流量、排名和一个展示用的动量分数，但只能作为**有上限、经预言机中介的"证据"**影响创作者*估值*，绝不直接乘到价格、领取额或 USDC 上。权重是次线性且封顶的，所有人都有一个完整的基础权重起点，身份不可转让也不可用钱购买——既让策展经济保持正当（而非寡头化），也与合规防火墙一致。

---

## 🏗 工作原理

```mermaid
flowchart LR
  User["创作者 / 赞助方 / 粉丝"] --> App["Next.js 应用"]
  App --> API["Express v1 API"]
  API --> DB["Postgres / Prisma"]
  API --> R2["Cloudflare R2"]
  API --> Mux["Mux 视频"]
  API --> Jobs["索引 / Reconciliation"]
  API --> Chain["Solana / Anchor"]
  Oracle["Oracle / 运营"] --> API
  Oracle --> Chain
  Chain --> Jobs
  Jobs --> DB
```

- **工作流 DB-first：** 草稿、manifest、上传、媒体处理、proposal intent、重试、workspace 状态。
- **资金 chain-first：** 赞助出资、proposal 创建、结算、退款、token mint/burn、不可变内容锚定。

Anchor 程序提供 **35 个类型安全指令**和 **13 个 PDA 账户类型**，覆盖完整生命周期——S1 发现、S1 买断、S2 活动、三轨结算、内容锚定，以及协议/用户/组织状态。

---

## ⚡ 为什么选择 Solana

每个核心机制都依赖 Solana 的某个特定能力——这不是营销话术：

| 能力 | 为什么重要 |
|---|---|
| **约 400ms 终局性** | S1 bonding-curve 买卖必须即时确认，体验才可用 |
| **不到 1 美分手续费** | 让 Track 2 微结算和 Track 3 CPS 支付在经济上可行 |
| **Token-2022 NonTransferable** | 在协议层强制 `SPUMP` 不可转让，而非靠约定 |
| **PDA 架构** | 配置、档案、S1 头寸、proposal、USDC vault 都是确定性、可验证的链上状态 |
| **Anchor 框架** | 整个产品生命周期的 35 个类型安全指令集于一个程序 |
| **生态** | 钱包适配器、Web3Auth 社交登录、成熟 RPC，以及用于快速迭代的 devnet |

---

## 📍 当前状态

StreamPump 目前是一个**已部署的受控技术 Pilot——仅限 Solana devnet/test-USDC、邀请制、external-wallet-first、Track1-only、无真实资金，且不是公开生产上线。** H0–H4 均已批准。P4 已完成固定 devnet program 升级、26 项 Neon migration（恢复分支继续保留）、固定版本的前后端部署、真实 R2/Mux/feed/proposal 走廊验证、手动 Track 1 恰好一次结算/重放，以及 allowlist 清理。Render 当前运行后端 `88c0debad6ecb7eacfe9e24793951f3794353f4c`（`dep-d9auio7lk1mc73c4r18g`）；Vercel 仍为前端 `097e9805b197398ae1c04cf5bf84f1044b3b2f19`。P5 只获准进行有界的 Pilot 运营、可靠性、安全与可观测性加固，并必须停在 H5；P6 与所有关闭通道仍未获授权。

### 邀请制 Pilot——受控技术部署，非公开上线

访问由**外部真实钱包白名单**门控。auth challenge 对每一个有效钱包**形态完全相同**，邀请校验**只在有效签名之后**执行——白名单无法被提前探测。

**Pilot 走廊内开放：** 外部钱包认证；经 R2/Mux 完成的内容创建与上传；公开 feed 与帖子详情投影；proposal intent 创建；创作者 + 赞助方双签；后端 relay 完整签名交易；手动 Track 1 固定底价结算；作为投影/链上证据的活动凭证（PDA、tx 签名、manifest hash、内容锚点）。

**对所有 Pilot 用户关闭：** email/social/provider 托管钱包认证与公开托管执行；S1 市场/买断/portfolio 领取；Track 2 背书与粉丝奖励；Track 3 CPS；每日与互动奖励；自动 oracle 结算调度器；prototype/legacy 路由。

**内容真实性（P2）。** 上传先落到**私有 R2 源桶**，仅用于 presigned 暂存与 KYB 文档；一个**独立的公共交付桶**（`R2_DELIVERY_BUCKET`，必须与 `R2_BUCKET` 不同）只保存已验证/受信任的素材。后端记录每个素材的**服务端观测字节、MIME、大小与 SHA-256**，执行**串行化的月度上传配额**，运行 **Mux 对账**，随后将已验证素材提升至交付桶并清理源副本。**创作者无法自我验证**内容——进入 feed 前**必须经过 operator 审批**。

**API 幂等（P2）。** 内容与 proposal-intent 变更受**持久化、数据库支撑的幂等键**保护，重试的变更会回放已存结果，而非重复产生链上或 DB 副作用。

**Proposal 真实性（P2）。** proposal 只能从**具备 feed 资格的不可变 manifest**、**正的 Track 1 预算**、以及**创作者与赞助方双签**发起，后端确认**链上状态与已存条款一致**。**Track 2 与 Track 3 必须为零**；部分配置了 Track 2/3 的 proposal 会被**拒绝**。

**Track 1 结算真实性（P2）。** 手动 Track 1 operator 结算是**证据绑定、幂等、租约围栏（lease-fenced）且签名校验**的；活动凭证**区分 anchor、funding 与 settlement 签名**。历史上无法证明的 anchor-tx 签名已由 **migration 清除**，而非当作凭证展示。

**不得声称**（不要表述为已完成）：第三方 publication 独立验证；program 侧白名单强制；安全审计；公开/真实资金生产上线；真实资金。

**生产监听门（fail-closed）。** 生产环境下，除非每个 active RPC 都返回完整的 Solana devnet genesis hash、所配置的 program 账户存在且 `executable`、且链上 `ProtocolConfig.usdcMint` 与 `PILOT_EXPECTED_USDC_MINT` 完全一致，后端才会启动。相关 env：`PILOT_INVITE_ONLY`、`PILOT_INVITE_WALLETS`、`PILOT_EXPECTED_USDC_MINT`、`PILOT_CHAIN_PREFLIGHT_TIMEOUT_MS`。P2 新增运行时/配置：`R2_DELIVERY_BUCKET`（必须与 `R2_BUCKET` 不同）、内部 operator 密钥 `INTERNAL_OPERATOR_API_KEY`、`INDEXER_ENABLED`/`MUX_RECONCILIATION_ENABLED` 门控，以及打包在 backend 根目录下的**生产 IDL**（`STREAMPUMP_IDL_PATH=./idl/streampump_core.json`）。

**验证。** P0 安全修复（`5a7f355..6ee771e`）通过 Fable 5 审查；人工门 **H0 已批准**。P1 后端硬化（`b393bac`）通过 Fable 5 审查；人工门 **H1 已批准**。**P2（`d78815b..e0b6028`）已通过一次独立的 Fable 5 审查（PASS，2026-07-12，无 blocker/major 问题），且人工门 H2 已批准——已实现并在本地验证，但尚未部署、尚未对真实资金上线；未进行任何部署、迁移应用、真实凭证 smoke 或 readiness 提升。** **P3**（pilot 恢复 + readiness 门控，集成的 Codex 后端基座 commit `d14a20f` 加后续修复 `96e9075`）新增 `/health` 存活探针与独立的 `/ready`（在 DB + 已启用的 Indexer + 已启用的 Mux 就绪前返回 503）、要求手动 Track 1 的 Oracle 签名者等于链上 `ProtocolConfig.oracleAuthority` 的 preflight、经审计且仅限 operator 的链上 replay / publication 重开-撤销 / Mux requeue / no-resend Track 1 对账，以及带 `isPublicFeedEligible` 的安全创作者 manifest 诊断。后续修复 `96e9075` 强化 indexer 使其 fail-closed：启动时要求真实的公共 `onSlotChange` 通知加 `getSlot`，运行时若 slot 心跳停滞（90s）或 RPC 探测失败，则将 readiness 的 Indexer 信号降级为 FAILED，使 `/ready` 返回 503；有序签名回填在第三次有界 NOT_FOUND 时把签名标记为终态 `PRUNED`（operator replay 可将其重置为 PROCESSING 并随后 SYNCED）。**对初始 P3 范围（`84c3415..109767f`）的首次 Fable 5 审查未发现 blocker，但有 2 项 major 问题；两者均已在 `96e9075` 本地修复。对固定范围 `84c3415..d783301` 的强制 Fable 5 复审现已 PASS（2026-07-12，无 blocker/major 残留）。Fable 自身的 Bash 测试重跑因权限被拒，故其 PASS 结论基于代码/测试检查加下述编排器已执行的证据——不得暗示 Fable 本身运行了测试套件。** H3（人工审查节点）现已于 2026-07-12 批准；人类随后授权了一次 commit/push/merge 轮次，且本次执行轮次针对 `codex/post-deadline-phase-0` 集成分支而非生产 `main`，作为避免触发 Render/Vercel 生产的操作安全选择；下一道且当前唯一的门是一次显式的生产变更审批（P4）。其两个 P3 迁移（`20260712170000_chain_ingestion_recovery`、`20260712180000_pilot_operator_events`）**在早前 P3 工作中于本地新增、本次工作未应用**（实际环境/数据库的应用状态未经检查）；后续修复是在既有 P3 schema/迁移上修改，未新增迁移。P3 后端验证（修复后）：Prisma validate PASS；后端 build PASS；聚焦套件 **20/20**；**完整后端 187/187 通过**；精确生产 IDL 校验器（**35 instructions / 13 accounts / 66 types / 87 errors**）；Anchor 构建加 P2 Track1-only 本地链上套件（**3 项通过**）；app lint 与生产 build **PASS**；`git diff --check` 于编辑后运行。P2 本地已验证：Prisma generate + validate；后端构建；**150 项后端测试**；生产 IDL 校验器（**35 instructions / 13 accounts / 66 types / 87 errors**）；Anchor 构建；**12 项关键本地链上测试**；app lint + build；以及 `git diff --check`。最终 Opus UI 真实性修复（`5ad0065`）修正 onboarding 的外部钱包/Track 1 文案，不带 preview/seeded 徽标，并将 portfolio/rewards 从正常 Pilot 导航中移除（legacy 路由仍保留标签、仅可直链访问）。已在 in-app Browser 中于 `/onboarding` 与 `/campaigns/not-a-pda` 桌面端与 390px 移动端浏览器验证：控制台干净、无框架 overlay 或横向溢出、外部钱包登录导航可用，且活动错误 fail-closed、无本地回退。**真实生产走廊与 Track 1 smoke 未执行**，因为缺少可用的 Pilot 凭证与线上 proposal——smoke 脚本 fail-closed 并给出明确 blocker，因此走廊**尚未**被称为线上或生产就绪。此次 Fable 5 审查记录了两条非门控观察：(1) 在 Render/Cloud Run/Railway 已识别标记之外的托管平台，仍依赖 `NODE_ENV=production` 或显式 `PILOT_INVITE_ONLY` 才能进入生产门控路径；(2) 月度上传配额归属以 asset `createdAt` 为键，因此跨月重新 presign 的归属为近似值。

**下一道门：** H4 已于 2026-07-14 获得明确批准。P5 将冻结一个有界的 control-plane 加固 candidate，只运行风险对应检查，并仅把未覆盖的 `34f3d96..candidate` 范围交给 Fable 5。获得 0 blocker/major 后，工作停在 **H5**；没有单独的 H5 批准不得开始 P6。

**任何公开或真实资金上线前的剩余 blocker：** 外部安全审计、法律/代币定性审查、生产政策与司法辖区/KYC 决策，以及对每条当前关闭通道的单独批准。即使到 H6，也不会自动免除这些前置条件。

| 区域 | Readiness | 当前真实能力 |
|---|---|---|
| **Pilot 走廊（邀请制）** | 已部署的受控技术 Pilot · 仅 devnet/test-USDC | 外部钱包认证 → R2/Mux 媒体 → feed → proposal intent → 双签 → 后端 relay → 手动 Track 1 → 活动凭证 |
| **S1 市场 / portfolio / 买断** | Pilot 关闭（代码为 `SEEDED_DEMO`） | 买卖/领取/买断代码针对种子 devnet 状态存在，但对 Pilot 用户禁用 |
| **S2 proposal 发起** | 已在 devnet 代码验证 | 双签发起走廊已验证；是 Pilot 中唯一开放的资金流 |
| **S2 背书** | Pilot 关闭（代码为 `BACKEND_READY_UI_GAP`） | 种子 proposal 的链上 burn + 后端 builder 存在，但对 Pilot 用户禁用 |
| **结算 Track 1（手动）** | `OPERATOR_REQUIRED` | Pilot 仅允许手动固定底价支付；无自动结算 |
| **结算 Track 2/3（CPS）** | Pilot 关闭 | Track 2 背书 + Track 3 CPS 对 Pilot 用户禁用；Track 3 仍需真实商户/对账提供方 |
| **托管钱包 / email-social 认证** | Pilot 关闭 | 对所有 Pilot 用户禁用；仅限外部真实钱包 |
| **奖励** | Pilot 关闭 | 每日/互动/粉丝奖励对 Pilot 用户禁用 |
| **运营工具** | `OPERATOR_REQUIRED` | 内部路由已具备；尚无后台面板 |

> ⚠️ Anchor 程序**未经审计**、**未部署生产**。此版本是 devnet/test-USDC 上的邀请制 Pilot 候选——**未上线、无真实资金**。新的链上护栏和奖励逻辑需要先部署程序才能在链上生效。

### 合规与代币定性（设计推进中）

`SPUMP` 是非转让的效用/消耗单位，**无货币价值、无利润预期**。为了让 backing 保持为有代价的信念信号、同时**不**构成投资合同，backer 的 USDC 机制已从"按持仓比例分买断款"重新设计为**有上限、由赞助方出资、且不随 staked `SPUMP` 数量缩放的发现奖励**（创作者拿到买断款的大头），并以永久创始身份、而非 USDC 作为主奖励。这套重设计**已在工作分支上完成代码级实现**，且在公众真实资金上线前**仍被门控**，门槛包括：一次 Anchor 审计、一份法律代币定性意见书、程序部署、地域限制，以及对收 USDC 用户的 KYC。详见 [docs/protocol/spump-compliance-and-value-model.md](docs/protocol/spump-compliance-and-value-model.md)。在这些门槛清除前，所有 USDC 奖励流都应视为仅 demo/种子用途。

完整情况见 [docs/streamPump-long-term-roadmap.md](docs/streamPump-long-term-roadmap.md)（权威路线图 + 进度账本）与 [docs/product-readiness-phase-0.md](docs/product-readiness-phase-0.md)。

---

## 📦 仓库结构

| 路径 | 作用 |
|---|---|
| `programs/streampump-core` | Anchor 程序：协议状态、S1、S1 买断、S2 三轨结算、内容锚定 |
| `programs/tests` | 10 个 Anchor TypeScript 测试套件（happy/unhappy、guard、buyout、S2 流程） |
| `backend` | Express v1 API、Prisma（23 模型 / 20 迁移）、R2/Mux、认证、索引、调度器、投影 |
| `app` | Next.js 15 前端：发现、创作者、资产、workspace、campaign、认证等界面 |
| `docs` | 协议设计、后端 API 合同、前端规范、部署说明、路线图 |
| `scripts` | devnet seed、demo、smoke、部署和 git hook 脚本 |
| `local-post-assets` | 本地开发 feed 和媒体 smoke 用的种子素材 |
| `third_party` | Anchor workspace 使用的 vendored Rust 依赖 |

---

## 🚀 本地启动

**前置要求：** Node.js 20+、npm、Rust toolchain、Solana CLI + Anchor（用于链上测试）、Postgres。

```bash
# 安装依赖（三个独立目标——无 monorepo 工具）
npm install
npm install --prefix app
npm install --prefix backend

# 创建本地环境变量文件（真实密钥只填进 .env.local——已被 Git 忽略）
cp app/.env.example app/.env.local
cp backend/.env.example backend/.env.local
```

### 前端

```bash
cd app
npm run dev          # http://localhost:3000
```

关键环境变量：

```text
NEXT_PUBLIC_BACKEND_BASE_URL=http://localhost:4000
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_IMAGE_REMOTE_HOSTS=pub-b0acd300bcec4dc5ba5ea36628dd809f.r2.dev
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=...
```

前端会自动从 `NEXT_PUBLIC_BACKEND_BASE_URL` 推导 `/api/v1`。

### 后端

```bash
cd backend
npm run prisma:generate
npm run build
npm run dev          # http://localhost:4000
```

常用环境变量：`DATABASE_URL`、`DIRECT_URL`、`AUTH_SESSION_SECRET`、`SOLANA_RPC_ENDPOINT`、`STREAMPUMP_PROGRAM_ID`、`R2_*`、`MUX_*`、`MANAGED_WALLET_ENCRYPTION_KEY`。详见 [docs/backend/env-and-vendor-guide.md](docs/backend/env-and-vendor-guide.md)。

### 链上程序

```bash
npm run build:anchor   # 产物输出到 /private/tmp，规避 macOS 文件同步卡顿
anchor test
cargo check            # 更轻量的类型检查
```

---

## 🛠 技术栈

| 层级 | 技术 |
|---|---|
| **Solana 程序** | Rust + Anchor 0.32、Solana CLI 2.3.0、Token-2022（NonTransferable mint） |
| **后端** | Express 4、TypeScript 5、Prisma 6、PostgreSQL |
| **前端** | Next.js 15、React 18、Tailwind CSS 3、TypeScript 5 |
| **对象存储** | Cloudflare R2（经 AWS SDK S3 传输） |
| **视频** | Mux（上传、webhook、reconciliation、HLS） |
| **认证** | 钱包适配器（Phantom、Solflare）、Web3Auth、邮箱 OTP、钱包挑战 |
| **部署** | Vercel（前端）、Render（后端）、Neon（DB）、Cloudflare R2、Mux |
| **Program ID** | `FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp` |

---

## 🎬 Demo 路径

> 以下是**历史受控演示**——运行在 devnet/test-USDC 上、供参考的种子/运营演练。它是邀请制 Pilot 走廊的超集，其本身不代表当前 Pilot 可用性，也不代表已部署或已上线。

历史受控演示刻意收敛为两条受控流程：

```text
S1 受控 demo
  → seed devnet S1 市场 + 已毕业买断
  → 打开 /market/:creatorWallet → 钱包会话下买卖 S1
  → 打开 /buyout/:creatorWallet → 从种子持有头寸领取 USDC
  → 验证 /portfolio 读模型

S2 活动 demo
  → 钱包登录 → 内容 manifest → proposal intent
  → 创作者签一次 launch bundle → 赞助方签名并提交一次
  → 确认的 Solana 活动
  → campaign 详情展示 PDA、交易签名、manifest hash、内容锚定、轨道状态
```

完整 runbook、环境开关、seed 脚本和验收清单见 [DEMO.md](DEMO.md)。

> **边界说明：** S1 买断形成和 S2 Track 3 对账在 demo 中由运营/种子脚本准备，不作为真实的外部集成呈现。

---

## 🧪 测试

```bash
npm run build --prefix app
npm run build --prefix backend
cargo check
npm run test:backend        # 15 个后端套件
npm run test:anchor         # 10 个 Anchor 套件（需本地 validator）
```

聚焦套件：

```bash
npm run test:s1:happy
npm run test:s1:unhappy
npm run test:s1:buyout
npm run test:s1:buyout:unhappy
npm run test:s2:unhappy
```

---

## ☁️ 部署

| 模块 | 平台 |
|---|---|
| 前端 | Vercel（root directory `app`，build `next build`） |
| 后端 | Render（root directory `backend`） |
| 数据库 | Neon / Postgres |
| 对象存储 | Cloudflare R2 |
| 视频 | Mux |

Render build / start：

```bash
npm ci --include=dev && npm run prisma:generate && npm run build
npm run start
```

应用生产迁移：

```bash
cd backend && npm run prisma:migrate:deploy
```

详见 [docs/backend/vercel-render-deployment.md](docs/backend/vercel-render-deployment.md)。

---

## 🗺 路线图

当前优先级：**P5 有界的 Pilot 运营、可靠性、安全与可观测性加固**；边界仍是邀请制、devnet/test-USDC、external-wallet-first、Track1-only、manual/operator-only、无真实资金。P4 已完成且 H4 已批准；P5 必须通过 exact-range Fable 5 gate，并停在 H5。

- **P4 门控顺序（历史，已完成）：** 受控 program/Neon/Render/Vercel/Mux 变更、真实一次性钱包走廊、手动 Track 1 恰好一次结算/重放与 allowlist 清理，均在各自 mutation gate 下完成。当前后端为 `88c0deb`，allowlist 仅保留人类批准的外部钱包。
- **P5 门控顺序（当前）：** 从已接受边界 `34f3d96` 冻结有界 hardening candidate，只运行风险对应验证，对未覆盖范围做一次 Fable 5 审查，关闭 blocker/major，然后停在 H5。P5 不包含关闭通道或 readiness 提升。

- **P2 门控顺序（历史，已完成）：** (1) 固定 P2 commit 范围 `d78815b..e0b6028`，(2) 对其取得一次独立的 **Fable 5** 审查——**2026-07-12 PASS，无 blocker/major 问题**，(3) 未提出任何 blocker/major 问题，因此无需重跑，然后 (4) **人工门 H2 已批准**。
- **P3 门控顺序（历史，已完成）：** 首次 Fable 5 审查发现 2 项 major，均在 `96e9075` 修复；固定范围 `84c3415..d783301` 通过复审，H3 于 2026-07-12 获批。
- 保留 P4 已验证的专用 devnet RPC、run-scoped test-USDC freeze、打包 IDL、rollback evidence、部署 identity 与受控走廊/Track 1 proof，不把一次性 smoke 当作日常重复验证。
- 在任何真实资金或公开上线前完成外部安全审计 + 法律审查。

Post-Pilot backlog（对所有 Pilot 用户关闭——每项都需要后续 H 门以及各自的审计/法律/供应方前置条件）：

- 生产级身份验证和 email/social 托管钱包硬化（KMS/Vault、SOL 预算、恢复/导出）。
- 在关闭的 S1 通道通过审计后，产品化 S1 自助市场与买断形成 UI。
- 完成 S2 Track 2 背书领取体验和粉丝奖励账本。
- 在存在真实商户/对账提供方后开放 Track 3 CPS / 自动结算。
- 为 oracle、风控审核、对账和结算监控添加运营后台。
- 构建忠诚度/粉丝牌层与 `SPUMP` 消耗汇（打赏、助推、等级领取）——见 [docs/protocol/fan-loyalty-and-spump-economy.md](docs/protocol/fan-loyalty-and-spump-economy.md)。

---

## 📚 文档索引

- [DEMO.md](DEMO.md) — 受控 S1/S2 demo runbook
- [docs/streamPump-long-term-roadmap.md](docs/streamPump-long-term-roadmap.md) — 权威路线图 + 进度账本
- [docs/product-readiness-phase-0.md](docs/product-readiness-phase-0.md) — 黑客松后 readiness 边界
- [docs/protocol/s1-market-design.md](docs/protocol/s1-market-design.md) — S1 经济模型与护栏
- [docs/protocol/fan-loyalty-and-spump-economy.md](docs/protocol/fan-loyalty-and-spump-economy.md) — 忠诚度/粉丝牌层与 SPUMP 消耗汇（设计）
- [docs/protocol/spump-compliance-and-value-model.md](docs/protocol/spump-compliance-and-value-model.md) — 证券合规定性与 SPUMP 价值模型（设计）
- [docs/protocol/content-attribution-and-anchoring.md](docs/protocol/content-attribution-and-anchoring.md) — 诚实的内容锚定模型：归属而非所有权（设计）
- [docs/protocol/user-influence-and-leveling.md](docs/protocol/user-influence-and-leveling.md) — 平台等级与星探影响力：命名定稿 + Phase 1 只读骨架（设计）
- [docs/backend/proposal-launch-api-contract.md](docs/backend/proposal-launch-api-contract.md) — DB-first 发起合同
- [docs/backend/env-and-vendor-guide.md](docs/backend/env-and-vendor-guide.md) — 后端环境与供应商配置
- [docs/frontend/design.md](docs/frontend/design.md) — 前端设计体系

---

## 🔒 安全与 Git

```bash
./scripts/install-git-hooks.sh   # 在提交前阻止常见密钥模式
```

真实凭据不应写入 `.env.example`、文档、截图或 demo 日志。托管钱包密钥经 AES-256-GCM 加密，运行时需提供 `MANAGED_WALLET_ENCRYPTION_KEY`——切勿提交该密钥。

---

## 📄 许可

本仓库采用双许可结构：

- `programs/` 下的链上程序使用 [Apache License 2.0](programs/LICENSE)
- 后端、前端、脚本和文档使用 [Business Source License 1.1](LICENSE)

BSL 允许个人学习、testnet 实验、学术研究和向本项目贡献代码。商业使用需要单独授权。**2030 年 4 月 20 日**起，所有 BSL 覆盖的代码自动转换为 Apache License 2.0。

---

<p align="center">
  <sub>为创作者、粉丝以及为他们出资的赞助方而建——在 Solana 上结算。❤️</sub>
</p>
