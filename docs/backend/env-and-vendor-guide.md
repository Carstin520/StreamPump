# Backend Env And Vendor Guide

## 概览
这份文档对齐当前的 **Pragmatic Web2.5 Hybrid Architecture**：

- 重资产和结算：链上为准
- 高频业务流：DB-first
- 视频与内容素材：对象存储 + Mux
- Sponsor 最终 UX：尽量一次签名，复杂状态在后端消化

价格核对时间：**2026-03-26**。第三方价格可能变化，正式采购前建议再点开官方链接复核一次。

## P0：现在就要开通

### 1. PostgreSQL 数据库
- 推荐：`Neon Launch`
- 作用：Prisma 主数据库，存 `ContentManifest / ProposalIntent / TxBundle / Track2Event`
- 当前优先级：最高，没有它 backend 不能跑
- 官方价格参考：
  - Launch 是 usage-based，官方页面给出的 typical spend 约 `"$15 /mo"`
  - Compute：`$0.106 / CU-hour`
  - Storage：`$0.35 / GB-month`
  - Branching：`$0.002 / branch-hour`
  - Public egress：前 `100 GB` 包含，之后 `"$0.10 / GB"`
- 建议预算：
  - 本地开发：`$0`
  - 云端 MVP：`$15-$30/month`
  - 两到三个环境并存：`$20-$50/month`
- 当前项目适配说明：
  - `Prisma + 自建 backend` 和 Neon 非常贴合，不需要引入任何 Neon SDK
  - 运行时建议 `DATABASE_URL` 走 pooled connection
  - Prisma migration 建议 `DIRECT_URL` 走 direct connection
  - 这也是 Neon 官方对 Prisma + PgBouncer 的推荐方式
- 官方来源：
  - https://neon.com/pricing
  - https://neon.com/docs/connect/connection-pooling
  - https://neon.com/docs/connect/connection-errors

### Neon 项目创建建议
- PostgreSQL version：`17`
- Cloud service provider：`AWS`
- Neon Auth：`先不要开`
- 原因：
  - `Postgres 17` 现在是稳定主线，Neon 当前支持 `14 / 15 / 16 / 17`，并提供 `18 preview`
  - 你现在的项目没有依赖某个旧版本特性，也没有兼容包袱，直接选 `17` 最合理
  - `AWS` 是默认更稳的选择，Neon 在 AWS 上 region 选择更多，也更贴近你当前 `S3/R2 + Mux + 自建 backend` 的组合架构
  - `Neon Auth` 不是你当前的认证路线；你现在走的是钱包认证方向，开启它只会增加系统复杂度
- 什么时候改选：
  - 如果你的应用服务器未来明确全部部署在 Azure，再考虑把 provider 选成 Azure
  - 如果未来你要放弃钱包优先认证，转成邮箱/社交登录为主，再评估 Neon Auth

### 2. Solana RPC
- 推荐：`Helius Developer`
- 作用：查询 proposal / creator / S1 buyout 链上状态、发送 oracle settlement、后续做 bundle relay 和 event indexing
- 当前优先级：最高，没有稳定 RPC，链上侧无法正常联调
- 官方价格参考：
  - Free：`$0/month`，`1M` monthly credits，`10 req/s`
  - Developer：`$49/month`，`10M` monthly credits，`50 req/s`
  - Business：`$499/month`，`100M` credits，`200 req/s`
- 建议预算：
  - 本地原型：`$0`
  - 封闭测试 / pilot：`$49/month`
  - 明显高频链上读取或事件流：`$499/month`
- 官方来源：
  - https://www.helius.dev/docs/billing/plans

### Market read model 运行说明
- P0 market API 是只读投影，必须有 `DATABASE_URL` / `DIRECT_URL` 和稳定 `SOLANA_RPC_ENDPOINT`
- `STREAMPUMP_PROGRAM_ID` 必须和当前环境部署的 Anchor program 一致
- `STREAMPUMP_IDL_PATH` 建议显式指向同一版 IDL；未设置时 backend 会尝试读取 `target/idl/streampump_core.json`
- 只跑 P0 read model 时可以先不配置真实 `ORACLE_AUTHORITY_*`
- 如果要让后端执行 Track settlement 或 server-side Anchor 交易，再补 `ORACLE_AUTHORITY_KEYPAIR_PATH` 或 `ORACLE_AUTHORITY_SECRET_KEY`

### 3. 对象存储
- 推荐：`Cloudflare R2` 作为当前最省钱的 S3-compatible 起步方案
- 作用：存原始图片/视频素材；当前 `S3_*` 变量就能接 S3-compatible 存储
- 当前优先级：最高，没有它就无法跑内容上传
- 官方价格参考：
  - Free tier：`10 GB-month` storage、`1M` Class A、`10M` Class B
  - Standard storage：`$0.015 / GB-month`
  - Class A：`$4.50 / million`
  - Class B：`$0.36 / million`
  - Egress：`Free`
- 建议预算：
  - 10 GB 内测试：`$0`
  - 100 GB 素材：约 `storage $1.50/month`，外加少量操作费
  - 500 GB 素材：约 `storage $7.50/month`
- 说明：
  - 当前 `content manifest` 新流程只依赖 `S3_*`
  - `R2_*` 仅在旧版 `storage.ts` 双写原型中可选使用
- 官方来源：
  - https://developers.cloudflare.com/r2/pricing/

### 4. 视频转码与播放
- 推荐：`Mux`
- 作用：视频转码、播放 ID、处理回调
- 当前优先级：高，如果你要支持短视频流，这个基本是必需品
- 官方价格参考：
  - 当前代码用的是 `video_quality: "basic"`
  - Basic quality input：`Free`
  - Basic and plus storage 首档 1080p：约 `$0.003 / minute / month`
  - Basic and plus delivery：前 `100,000` 分钟/月免费，之后 1080p 首档约 `$0.001 / minute`
  - 如果未来切 Plus quality input，1080p 首档约 `$0.03125 / minute`
- 建议预算：
  - 开发 / 内测，1,000 分钟库存视频：约 `storage $3/month`
  - 100,000 分钟内观看：delivery 仍可接近 `0`
  - 如果观看明显放大，按 `~$1 / 1,000 1080p delivered minutes` 粗估
- 官方来源：
  - https://www.mux.com/docs/pricing/video

## P1：一周内建议开通

### 5. Redis / Queue
- 推荐：`Upstash Redis`
- 作用：
  - 把当前内存版 anti-cheat ledger 移到可多实例共享的状态
  - 做 idempotency、队列、rate limit、settlement batch cursor
- 当前优先级：中高，单机 demo 可以先不买，多实例或对外 pilot 建议立刻补
- 官方价格参考：
  - Free：`256MB`、`500K commands/month`
  - Pay-as-you-go：`$0.20 / 100K commands`，`$0.25 / GB` storage，前 `200GB` bandwidth 免费，之后 `$0.03/GB`
  - Fixed 250MB：`$10/month`
- 建议预算：
  - MVP：`$0-$10/month`
  - 小规模 pilot：`$10-$20/month`
- 官方来源：
  - https://upstash.com/docs/redis/overall/pricing
  - https://upstash.com/pricing

### 6. 托管钱包 / 嵌入式钱包
- 推荐：`先不买`
- 当前建议：
  - 现在后端认证还没有切到真正的钱包 challenge/signature 登录
  - 如果短期只是内测，直接做原生钱包签名认证，成本最低，`$0`
  - 如果你要更像 Web2 App，后续再评估 `Privy`
- `Privy` 官方价格参考：
  - Free：`0-499 MAU`，`$0`
  - Core：`500-2,499 MAU`，`$299/month`
  - Scale：`2,500-9,999 MAU`，`$499/month`
  - 所有 Developer plans 都含每月 `50K signatures` 免费额度
- 建议预算：
  - 当前阶段：`$0`
  - 如果要做社交登录 / 嵌入式钱包内测：`$0` 或直接跳到 `Privy $299/month`
- 官方来源：
  - https://www.privy.io/pricing

## P2：产品验证后再接

### 7. 电商 / CPS 对账 API
- 作用：补全 Track3 的真实结算依据
- 当前状态：代码里还是 stub
- 推荐方向：
  - Shopify
  - Amazon Associates
  - TikTok Shop
  - 淘宝联盟 / 京东联盟 / 拼多多等
- 价格说明：
  - 大多数不是单独 API 月费模式，而是平台佣金、商家账号或合作报价
  - 这一块更像商务接入，不是今天就要采购的基础设施

### 8. 内容平台验证 / 数据源
- 作用：给小红书式内容做发布验证、证据留存和争议处理
- 当前状态：
  - 仓库里只保留了 YouTube / TikTok 的 Chainlink Functions 示例
  - 还没有小红书正式接入
- 推荐方向：
  - 先人工审核 + DB 证据固化
  - 后续再看官方开放平台、第三方数据商、或自建采集

## 建议采购顺序
1. `Neon Launch`
2. `Helius Developer`
3. `Cloudflare R2`
4. `Mux`
5. `Upstash Redis`
6. `Privy` 或其他托管钱包方案

## 一个现实的月成本区间

### 最小可运行闭环
- Neon Launch：`$15-$30`
- Helius Developer：`$49`
- R2：`$0-$2`
- Mux：`$0-$10`
- 合计：**约 `$64-$91/month`**

### 有短视频 pilot 的封闭测试
- Neon Launch：`$20-$50`
- Helius Developer：`$49`
- R2：`$2-$8`
- Mux：`$20-$80`
- Upstash：`$0-$10`
- 合计：**约 `$91-$197/month`**

## 你现在需要准备的外部信息
- Neon `DATABASE_URL`（pooled）
- Neon `DIRECT_URL`（direct）
- Solana RPC endpoint
- StreamPump program id
- StreamPump IDL path / IDL artifact
- Oracle authority keypair
- S3-compatible bucket / key
- Mux token 与 webhook secret

## 备注
- 当前仓库里 `build-bundle` 还是 skeleton，所以现在还不需要购买复杂的 relayer SaaS
- 当前 `auth.ts` 还是 stub，所以托管钱包不是今天的 blocker
- 如果你想极限压缩成本，`Neon + Cloudflare R2 + Helius + 原生钱包签名` 就足够先跑第一轮内测
