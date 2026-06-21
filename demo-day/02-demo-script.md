# StreamPump — Demo Day 现场脚本（面向 Solana 开发者 / 评委）

> 时长目标：5 分钟讲述 + 90 秒现场 live demo（可压缩到 3 分钟版，见末尾）
> 听众：Solana 开发者 / 评委（投资人背景，看 MVP + 技术执行 + 商业模式）
> 核心策略：**用"真实链上跑通"碾压满屏 PPT 的同行；用"反投机叙事"区别于 pump.fun 系；主动讲合规体现成熟度。**

---

## 黄金法则（记在心里）

1. **前 30 秒必须钩住**。评委一天看几十个 deck，开场不要讲背景，直接抛差异化。
2. **Demo 要看到链**。Solana 评委最买账的不是 UI，是 Explorer 上真实的 PDA 和 tx signature。务必现场打开 explorer。
3. **主动谈证券合规**。评委是投资人，一定担心 Howey。你先讲，他们就放心；你不讲，他们就扣分。
4. **每个机制都绑定一个 Solana 能力**。不要说"我们用了 Solana"，要说"这个机制没有 Solana 这个特性就不成立"。

---

## 开场钩子（0:00 – 0:30）

> "Web3 试过解决创作者经济——基本都失败了。friend.tech 的日活从 8 万崩到不足 1 万，开发者直接弃用了合约。为什么？因为它们都是**代币优先**：发币、投机、view-to-earn 砸盘、然后死亡螺旋。
>
> StreamPump 反着来。我们不发可交易的币，我们做的是**创作者赞助的链上信任与结算层**——内容是资产，粉丝是早期支持者，赞助商是真实的营销付费方。而且——这不是一个 demo PPT，**它在 devnet 上已经端到端跑通了**。我现在就给你们看链上的证据。"

（立刻切到 demo，趁注意力最高）

---

## 现场 Live Demo（0:30 – 2:00，约 90 秒）

**演示这一条已验证的走廊**（roadmap 2026-05-18 已验证），这是你最强的资产。

**Demo 路径（建议预先录屏 + 现场穿插，避免网络翻车）：**

1. **创作者发内容**（10s）：在 `/workspace/content/new` 展示已发布的一条内容（R2/Mux 真实视频），强调"内容存在创作者自己的平台，我们只在链上放一个**发布时间戳 + 完整性指纹**——不是 tokenize，不是声称拥有，是**归属证明**。"
2. **内容出现在公共 feed**（10s）：`/explore` 或 `/posts/[postId]`，读的是后端投影，不是假数据。
3. **开 proposal intent → 双签 → 上链**（20s）：创作者签 + 赞助商签 → 后端中继到 Solana。强调"资金进 Solana vault，链是财务真相"。
4. **Campaign proof 页面**（20s）：`/campaigns/[proposalId]` 展示**真实 PDA、tx signature、manifest hash、FUNDED 状态**。
5. **★ 高光时刻**（20s）：**打开 Solana Explorer（devnet）**，把页面上的 tx signature / PDA 贴进去，让评委看到链上账户真实存在。
   > "这就是 Web2 中介给不了的东西——**可审计的交付证明**。品牌方第一次可以在链上验证一笔赞助到底发生了什么。"

**话术收尾：** "整个过程：DB 管草稿/上传/重试（快、灵活），链管资金/结算/证明（可验证）。这就是我们说的 **DB-first for workflow, chain-first for financial truth**。"

---

## 为什么是 Solana（2:00 – 3:15）—— 技术评委的核心段

不要泛泛而谈。每条能力对应一个**没有它就不成立**的机制：

| Solana 能力 | StreamPump 里非它不可的原因 | 现场可量化的点 |
|---|---|---|
| **Token-2022 `NonTransferable`** | SPUMP 必须不可转让，才能"以时间/注意力计价的 skin in the game"而非投机筹码。**关键细节：NonTransferable 在协议层禁转，但 `Burn` 仍被允许**——所以"burn SPUMP 去 back 创作者"这个核心机制**原生成立**，不需要任何 hack。 | 协议层强制，不是应用层君子协定 |
| **~150ms 终局性（Firedancer 时代）** | S1 bonding curve 的买/卖/价格更新必须秒内确认，否则 UX 崩。 | Firedancer 已于 2025-12 上主网，终局性 ~150ms |
| **<$0.001 单笔费用** | Track 2 微额结算、Track 3 CPS 逐笔分账才有经济意义。以太坊 L1 上根本不可能。 | 平均费 < $0.001 |
| **PDA 架构** | ProtocolConfig、CreatorProfile、S1 仓位、Proposal、USDC vault——全是确定性地址派生的可组合链上状态，任何人可查可验。 | 13 类 PDA 账户 |
| **Anchor** | 一个程序里 34 条类型安全指令覆盖 S1 发现/buyout/S2 三轨结算全生命周期。 | 34 instructions, 65 error variants |

**一句话总结这段：** "StreamPump 的每一个核心机制——不可转让的 conviction、bonding curve 的实时 UX、逐笔微结算——**都依赖 Solana 的具体能力。换条链做不出来。**"

> 💡 对 Solana 评委最炸的一点：**"NonTransferable 禁转但允许 Burn"** 这个组合细节，说明你真的读懂了 Token-2022，而不是套模板。一定要讲。

---

## 主动谈合规（3:15 – 3:50）—— 成熟度信号

> "你们作为投资人一定会问：粉丝 back 创作者再分 USDC，这是不是证券？我们认真做过 Howey 分析。**当前的 pro-rata 分配确实有投资合约风险**——所以我们的 go-to-market **先上线零证券风险的部分**：固定赞助托管 + 链上交付证明，本质是透明 escrow。高风险的 buyout 分润，我们押到拿到法律意见和 Anchor 审计之后，并且首发**地域门控排除美国**。
>
> 我们的代币设计核心是一道**合规防火墙**：影响力和 SPUMP 可以自由驱动触达和声誉，但**永远不直接乘以任何 USDC 金额**。"

这一段会让你在一屋子"避而不谈证券"的项目里显得格外可信。

---

## 收尾与要钱（3:50 – 5:00）

- **现状一句话**：链上程序是高级原型（34 指令、devnet 走廊已验证），后端是集成原型，前端 demo-ready，两条 demo 路径可跑。
- **要什么**：明确你要的（accelerator 名额 / 种子赞助预算 / 法律资源 / 首批垂直创作者）。Colosseum 评委在找可投的公司，给他们一个 ask。
- **愿景收口**：
  > "我们不是又一个代币投机平台。我们在建下一代创作者-赞助关系的基础设施——价值在创造者和出资者之间直接流动，全部在 Solana 上结算。"

---

## 应对评委可能的尖锐提问（提前准备）

| 问题 | 你的答案要点 |
|---|---|
| "这是不是证券？" | 已做 Howey 分析；GTM 先上零风险楔子；buyout 分润押后到法律意见 + 审计；首发非美地域门控；防火墙：影响力永不乘 USDC。 |
| "Oracle 不是中心化单点吗？" | 是，第一版中心化；给出去信任化路线（多签 oracle → 签名证据摘要上链 → 逐步引入指标提供方/oracle 网络）。诚实承认 + 有路径。 |
| "三边市场怎么冷启动？" | 创作者优先、单一垂直、非美地域；用平台/种子赞助预算跑出第一批可验证 case；粉丝层最后开。 |
| "SPUMP 凭什么有价值又没价格？" | 价值=非货币 utility（cheer/boost/badge 消耗）；通过解耦奖励与 stake + 硬封顶，把隐含美元价格压成噪声。 |
| "程序审计了吗？" | 还没；mainnet 前会冻结指令接口 + 第三方审计。现在是 devnet 原型。诚实。 |
| "和 friend.tech / pump.fun 有什么不同？" | 它们代币优先、靠投机；我们内容为资产、币不可转让不上所、收益来自赞助商真实营销支出。 |

---

## 3 分钟压缩版（如果时间被砍）

1. 开场钩子（30s）
2. Live demo 只演**最后两步**：campaign proof 页面 + 打开 Explorer 看真实 tx/PDA（45s）
3. 为什么 Solana：只讲 **Token-2022 NonTransferable+Burn** 和 **sub-cent 费用**两条（45s）
4. 一句合规 + 一句 ask + 一句愿景（60s）

---

## Demo 前 24 小时检查清单

- [ ] 修复前端过期 program ID（`useProgram.ts` / `solana.ts` → `FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp`）
- [ ] 录好 demo 走廊的备用录屏（防现场网络/RPC 翻车）
- [ ] 预先在 Explorer 打开好真实的 PDA / tx 页面标签页
- [ ] 确认 devnet RPC 健康、seeded 状态在位（参考 `DEMO.md`）
- [ ] 关掉任何会泄露 mock/preview 的页面，只留可信走廊
- [ ] 准备好一页"现状 readiness"诚实说明（防"这到底跑通没有"的追问）
