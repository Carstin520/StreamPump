# B3 落地计划与安全边界 — backing 面 (2026-06-24)

> 基于 backing 各页 data-truth 核查。落地以本文为安全契约。能量语言、保留 readiness、不动签名链。

## 绝对不可改动（签名链 / 会话写入 —— 动了会破坏真实交易）
- market `TradePanel`：`flow.execute((token)=>buildS1BuyTransaction/SellTransaction(...))` + `S1TransactionDrawer` + `WalletSessionAlert`。
- buyout `RageQuitPanel`：`flow.execute((token)=>buildS1RageQuitTransaction(...))`；`ClaimPanel`：`buildS1ClaimUsdcTransaction(...)`；两处 `S1TransactionDrawer`/`WalletSessionAlert`。
- endorse `handleBeginEndorse`（managed/proposalFlow/demo 三分支）+ `handleClaimEndorsement` + `requireInteractiveSession` 守卫 + `useManagedWallet` 检测。
- onboarding `completeProfile`→`updateAccountMe({completeOnboarding:true})` + `canWriteProfile`(storageStatus==='LIVE') + `getAccountMe`。
- 所有 `ProductReadinessBanner` 与 readiness 文案保留。

## 数值真值（落地不得伪造，单位不得混淆）
- 真实 SPUMP（能量）：market `currentPriceSpump/nextPriceSpump`、buyout rage-quit `estimatedSpumpReturn`、endorse `totalStakedSpump`。
- 真实 USDC（赞助方真钱，正确显示 $/USDC）：buyout `acceptedOfferUsdc/creatorPayout/discoveryPool/估算封顶发现奖励`、campaign Track1/2/3 预算、vault。
- 真实 momentum（0–100 信号，非价格）：`momentumScore`、`graduationProgress`。
- **需修的伪造/混淆**：
  1. `CreatorStageView` `SPUMP_PER_USD=40` 把 USD `tokenPrice` 乘出假 SPUMP "S1 Position Price" —— 不得展示伪造价格；改为展示 momentum/势能 + 生命周期，价格只在 `/market` 真实交易区出现。
  2. `endorse.tsx` `CAMPAIGN_BRIEF`/`SPONSOR_NAME="Nova Screen"` 硬编码，live campaign 也照显 —— live 时须从 campaign 数据解析，避免显示错误赞助方。
  3. （已在 B2.1 修）TrendingTabs S1 列 header/值映射 —— 复核确认 势能/冲刺毕业/应援人数 一致。

## 子批次顺序（每批：sonnet 量产 → opus tsc+grep+critique 验收 → 单独 commit；均不碰上面签名链）
- **B3a onboarding**：全量 copy→i18n 能量语言；加 "🛡️ 这不是投资，是发现" + Earn/Back/留名 三概念定向；保留会话写入与 readiness。
- **B3b /trending 发现榜**：slogan + 类目 chips + 本周势能上升最快 movers + 卡片 ⚡Back/已应援 CTA + MomentumLine；零签名风险。
- **B3c /market + CreatorStageView**：加 MomentumLine（标"发现信号不是价格"）+ 生命周期条 + 社会认同（Top 星探/好友）+ 今日可投上限 + 名次/早鸟身份 + 封顶非比例免责；**修 CreatorStageView 伪造价格**；copy i18n。不碰 TradePanel 签名闭包。
- **B3d /buyout 毕业赞助赎回**：显式 keep-vs-rage 决策卡 + 创作者已接受 chip + 退出窗口倒计时同列 + 名次/身份 + 独立"非比例分红"免责框；copy i18n。不碰 RageQuit/Claim 闭包。
- **B3e /campaigns + endorse**：三轨可视化（左色条 + 80/20 + 进度）+ 链上凭证（PDA/锚/tx/vault + 可验证 badge）+ 背书者身份解锁 + 封顶平摊免责 + Track3 GATED 视觉；**修 endorse live 时 sponsor/brief 数据真值**；copy i18n。不碰 endorse 签名分支。

## 复用原语
MomentumLine / MomentumMeter / EnergyAmount / BackingCard(full) / ScarcityBar / LockedPanel / StagePill / ProductReadinessBanner / PriceHistoryChart / SparklineChart 均已存在。

## DoD（每批）
`npx tsc --noEmit -p app/tsconfig.json` 0 错；grep 红线（收购/盈亏/持仓/伪造价格）；保留 readiness；不破坏签名链（人工核对 execute 闭包未改）；单独 commit。
