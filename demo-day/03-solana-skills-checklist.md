# Solana 技能 / 文档 / MCP 学习清单（针对 StreamPump）

> 关于"找到对应 skill 并学习"的说明与结果。

## 搜索结果（诚实结论）

我在本 Cowork 环境里搜索了三处：插件市场（plugins）、可添加的独立 skills 目录、以及 MCP 连接器注册表。**结论：本环境内没有可直接安装的 Solana / Anchor 原生 skill 或插件。**

- 插件市场返回的都是 Zoom / 法务 / 财务 / CRM 等知识工作类插件，无区块链开发类。
- 独立 skills 目录无 Solana 相关项。
- MCP 注册表里有两个区块链相关连接器：
  - **QuickNode**（管理区块链基础设施，**支持 Solana RPC endpoint** —— 对你做生产 RPC 有用）
  - **Blockscout**（区块链数据分析，偏 EVM，对 Solana 帮助有限）

你提到的"Solana 官方的一些 skill"指的应是 Anthropic × Solana 官方发布的 **Solana MCP server / Claude Code skills**，它们托管在 GitHub（`solana-developers` / `solana-foundation` 相关仓库）和 Solana 官方文档里，需要安装进 **Claude Code 或你自己的开发环境**，而不是这个 Cowork 会话。我无法从 Cowork 内部安装它们，但下面给出明确的获取与学习路径。

> 注：我在本会话中也无法创建/编辑 skill；若要给项目装 skill，请在 Claude 桌面端 **Settings → Capabilities** 操作。

---

## 建议安装/学习的清单（按对 StreamPump 的相关度排序）

### A. 直接相关，建议装进 Claude Code 开发环境

1. **Solana 官方 MCP / Claude skill**
   - 来源：Solana 官方文档与 `solana-developers` GitHub（搜索 "Solana MCP server" / "solana skill claude"）。
   - 价值：让 Claude Code 能直接查 Solana 文档、生成/校验 Anchor 代码、查询链上账户。
   - 对你的用处：S1 buyout 重设计、Track2/3 结算数学、审计前的指令冻结都能加速。

2. **Anchor 官方文档 + 示例**（`anchor-lang` / `coral-xyz`）
   - 重点章节：账户约束（`#[account(...)]`）、PDA seeds、CPI、错误处理、`anchor test`。
   - 对你的用处：你已有 34 条指令，重点是**审计前的约束加固**和**Token-2022 CPI 正确性**。

3. **Token-2022 / Token Extensions 文档**（Solana 官方 + Helius / Chainstack 指南）
   - 必读：`NonTransferable` extension、`Burn` 在 NonTransferable mint 上仍被允许、permanent delegate、transfer hook 的坑。
   - 对你的用处：这是 SPUMP 的根基。demo 讲"禁转但可 Burn"这个细节就来自这里。务必吃透 mint 创建时启用 extension 的顺序与不可变性。

### B. 基础设施 / 运维相关

4. **QuickNode MCP**（本环境注册表里有，可连接）
   - 价值：管理 Solana RPC endpoint、安全规则。比公共 `api.devnet.solana.com` 稳。
   - 对你的用处：roadmap 里"付费 RPC provider"是已知 blocker，这个能直接帮上。

5. **Solana CLI / `solana-test-validator`**（你已在用 2.3.0）
   - 重点：本地验证器跑 Anchor 测试（`npm run test:chain:local` 已封装）。

### C. 审计 / 安全（mainnet 前必修）

6. **Neodyme "Token-2022: 别搬石头砸脚" 指南**
   - 价值：Token-2022 扩展的常见安全陷阱，审计前自查清单。
7. **Anchor 安全最佳实践 / Sealevel attacks 仓库**
   - 价值：账户校验、signer 检查、重入/算术溢出等——你的 `claim_*` / `settle_*` 资金路径必须过这套。

---

## 我用来给本次分析"补课"的官方/权威来源

由于无法安装 skill，我改用 web 抓取官方与权威资料来确保技术陈述准确：

- [Token-2022 NonTransferable（Solana 官方文档）](https://solana.com/docs/tokens/extensions/non-transferrable-tokens) —— 确认"协议层禁转 + Burn 仍允许"
- [What is Token-2022 / Token Extensions — Helius](https://www.helius.dev/blog/what-is-token-2022)
- [Token-2022 安全陷阱 — Neodyme](https://neodyme.io/en/blog/token-2022/)
- [Solana 2026 性能 / Firedancer — BYDFi](https://www.bydfi.com/en/cointalk/solana-transaction-speed-news-april-2026-firedancer-update)
- [Solana 2026 交易费 — BYDFi](https://www.bydfi.com/en/cointalk/solana-transaction-fees-2026-guide)

---

## 一句话建议

本环境装不了 Solana skill 不影响你 demo day。**真正要做的是把官方 Token-2022 + Anchor 安全两套文档吃透**（尤其 NonTransferable+Burn、资金指令的账户校验），再把 QuickNode 接上换掉公共 RPC。审计前的指令冻结 + 第三方审计才是 mainnet 的硬门槛——skill 只是加速器，不是阻塞项。
