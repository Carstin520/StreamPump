# Vercel + Render Deployment Guide

## 概览
这份文档给出一条最务实的 StreamPump 首次上云路径：

- `app` 部署到 **Vercel**
- `backend` 部署到 **Render**
- 数据库继续用 **Neon**
- 对象存储用 **Cloudflare R2**
- 视频继续用 **Mux**

这条路线适合你当前仓库的结构：
- 前端是标准 Next.js 应用
- 后端是长期运行的 Express 服务，内部还带 indexer、oracle scheduler、Mux reconciliation

当前价格和产品形态请以官方文档为准：
- Vercel pricing: https://vercel.com/pricing
- Vercel plans: https://vercel.com/docs/plans
- Render web services: https://render.com/docs/web-services
- Render service types: https://render.com/docs/service-types
- Render pricing: https://render.com/pricing
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/

## Pilot 部署边界（先读）

当前目标是**经代码验证的邀请制 Pilot 候选版本——未部署生产、未上线、无真实资金**。所有链上活动只指向 **Solana devnet 与一枚 test-USDC mint**。本指南是一条通用上云路径；按 Pilot 真值，落地时必须遵守以下约束：

- **仅 devnet。** 不要配置 mainnet RPC。生产环境下后端会在监听前校验每个 active RPC 的完整 Solana devnet genesis hash，不匹配即 fail-closed 拒绝启动。
- **邀请制 gate 必填。** 生产 Pilot 必须设置 `PILOT_INVITE_ONLY=true`、`PILOT_INVITE_WALLETS`（至少一个外部真实钱包）、`PILOT_EXPECTED_USDC_MINT`（Pilot test-USDC mint 真值）、`PILOT_CHAIN_PREFLIGHT_TIMEOUT_MS`。后端在监听前会读取链上 `ProtocolConfig.usdcMint` 并要求与 `PILOT_EXPECTED_USDC_MINT` 完全一致，且要求配置的 program 账户存在且 `executable`。
- **关闭与 Pilot 冲突的功能。** email/social/provider 托管钱包、公开托管执行、S1、Track 2 背书、Track 3 CPS、每日/互动奖励，以及**自动结算调度器（ORACLE）**对所有 Pilot 用户关闭。Pilot 禁止的是 ORACLE 自动结算调度器（`ORACLE_SCHEDULER_ENABLED` / `ORACLE_RUN_ON_BOOT` / Track2 / Track3 自动结算均为 `false`），而**不是** indexer 或 Mux reconciliation：媒体 corridor 需要 Mux webhook/reconciliation 的可见性，financial projection 需要 indexer 保持同步。因此 Pilot 建议 `INDEXER_ENABLED=true`；在配置真实 R2/Mux 之后建议 `MUX_RECONCILIATION_ENABLED=true`、`MUX_RECONCILIATION_RUN_ON_BOOT=true`。Pilot 中的 Track 1 结算由运营人工执行。
- **IDL 制品 blocker（未解决）。** Render 的 **Root Directory 设为 `backend`**，而后端运行时通过 `STREAMPUMP_IDL_PATH=../target/idl/streampump_core.json` 读取 IDL。构建产物位于仓库根的 `target/idl/`，**位于 `backend` 根目录之外**，因此不会进入 Render 部署的制品中。真实部署前必须先解决：把完整的生产 IDL 作为制品/包随后端一起交付（例如把 IDL 拷入 `backend/` 内的路径并相应设置 `STREAMPUMP_IDL_PATH`，或改用包含根 `target/` 的构建/根目录）。在此解决前，链上 preflight 与已部署走廊 smoke 都无法完成。

## 部署前检查

在真正点部署按钮前，先确认这些基础资源已经可用：

1. Neon 数据库已经创建
2. Cloudflare R2 bucket 已可读写，并已创建 R2 API token
3. Mux token 和 webhook secret 已准备
4. Solana RPC endpoint 已准备
5. `backend/.env.local` 里已经有一份本地可运行配置

本仓库已补好的部署前置项：
- 后端支持 `CORS_ALLOWED_ORIGINS`
- 前端有 [app/.env.example](../../app/.env.example)
- 后端有 `npm run prisma:migrate:deploy`

## 架构建议

### 第一阶段：先用 1 个后端服务
先不要一上来拆服务。

第一阶段可以这样跑：
- `Render Web Service`
  - Express API
  - Mux webhook
  - indexer
  - oracle scheduler
  - Mux reconciliation scheduler

这对早期测试足够简单，也更省运维成本。

### 第二阶段：再拆 worker
等你准备上真实流量，再拆成：
- `backend-web`
- `backend-worker`

但这不是今天的 blocker。

## Step 1：部署前端到 Vercel

### 1.1 在 Vercel 创建项目
1. 打开 Vercel Dashboard
2. 导入这个 GitHub 仓库
3. 在项目设置里把 **Root Directory** 设成：
   - `app`

### 1.2 Vercel 环境变量
在 Vercel 项目里配置：

- `NEXT_PUBLIC_BACKEND_BASE_URL`
  - 示例：`https://api.yourdomain.com`
- `NEXT_PUBLIC_RPC_ENDPOINT`
  - Pilot 仅用 devnet：示例 `https://api.devnet.solana.com` 或一个专用 devnet RPC endpoint
  - 不要配置 mainnet endpoint
- `NEXT_IMAGE_REMOTE_HOSTS`
  - 示例：`pub-b0acd300bcec4dc5ba5ea36628dd809f.r2.dev`
  - 只填写你控制的公开素材/CDN 域名，逗号分隔；前端会把路径限制在 `/content/**`
- `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID`
  - 如果当前 web 还要保留 Web3Auth

### 1.3 Vercel 构建配置
通常不需要自定义：
- Build Command: `next build`
- Output: Next.js default

如果 Vercel 已识别为 Next.js，保持默认即可。

### 1.4 前端上线后的检查
至少确认：
1. 首页能打开
2. `/explore` 能打开
3. `/workspace` 能打开
4. 浏览器里没有因为 API 地址错误导致的请求全挂

## Step 2：部署后端到 Render

### 2.1 在 Render 创建 Web Service
1. 打开 Render Dashboard
2. 新建 `Web Service`
3. 连接这个 GitHub 仓库
4. Root Directory 选择：
   - `backend`

### 2.2 Render 构建与启动命令
建议填写：

- Build Command
```bash
npm ci --include=dev && npm run prisma:generate && npm run build
```

- Start Command
```bash
npm run start
```

- Health Check Path
```text
/health
```

### 2.3 Render 环境变量
按 [backend/.env.example](../../backend/.env.example) 填，重点是这些：

#### App / Auth
- `NODE_ENV=production`
- `PORT=10000` 或 Render 默认端口注入
- `API_BASE_URL=https://api.yourdomain.com/api/v1`
- `CORS_ALLOWED_ORIGINS=https://app.yourdomain.com,https://your-vercel-domain.vercel.app`
- `AUTH_SESSION_SECRET=...`
- `AUTH_CHALLENGE_TTL_SECONDS=600`
- `AUTH_SESSION_TTL_SECONDS=604800`
- `AUTH_ALLOW_LEGACY_WALLET_HEADER=false`
- `AUTH_ALLOW_PREVIEW_PROVIDER_EXCHANGE=false`

##### Pilot invite-only gate（Pilot 必填）
- `PILOT_INVITE_ONLY=true`
- `PILOT_INVITE_WALLETS=<外部真实钱包地址,逗号分隔>`
  - 至少一个有效 Solana 钱包地址；challenge 对所有有效钱包同形，邀请校验只在签名后执行。
- `PILOT_EXPECTED_USDC_MINT=<Pilot test-USDC mint>`
  - 后端监听前会读取链上 `ProtocolConfig.usdcMint` 并要求完全一致。
- `PILOT_CHAIN_PREFLIGHT_TIMEOUT_MS=10000`

> Pilot 关闭 email/social/provider 托管钱包与公开托管执行。下面的 email/托管钱包变量属于未来托管钱包阶段，不是 Pilot 路径；除非该阶段真正启用，否则不要为 Pilot 打开它们。

- `MANAGED_WALLET_ENCRYPTION_KEY=...`
  - 仅在托管钱包阶段启用时需要；必须是 64 位 hex（32 bytes）。
  - 本地生成命令：
    ```bash
    openssl rand -hex 32
    ```
  - 只粘贴到 Render Environment，不能写进 Git、文档、截图或日志。
- `EMAIL_DELIVERY_MODE=resend`（仅 email 登录阶段；Pilot 关闭 email）
- `EMAIL_FROM=StreamPump <login@yourdomain.com>`
- `RESEND_API_KEY=...`

如果 Render runtime log 出现：

```text
Invalid production configuration: MANAGED_WALLET_ENCRYPTION_KEY must be set to 64 hex chars
```

说明 build 已经成功，失败发生在 `npm run start` 的生产配置校验阶段。若托管钱包阶段已启用，处理方式是给同一个 Render backend service 增加 `MANAGED_WALLET_ENCRYPTION_KEY`，值必须是 `openssl rand -hex 32` 生成的 64 位 hex，然后重新部署；不要为了让服务启动而删除这条校验，托管钱包私钥必须用这个 key 加密。注意：邀请制 Pilot 关闭 email/provider 托管钱包，因此 Pilot 阶段不应触发托管钱包分配。

#### Database
- `DATABASE_URL`
- `DIRECT_URL`

#### Solana / Protocol
> Pilot 仅用 devnet。b393bac 起，后端 production config 校验与**监听前的 preflight gate** 会 **fail-closed** 强制以下几项（代码保证）：
> 1. **每个 active RPC** 都必须通过完整 Solana devnet genesis hash 校验——active endpoint 不可达、无法返回完整 devnet genesis hash、或指向非 devnet 集群即 fail-closed 拒绝启动。（config 存在 fallback，缺失 env/config 本身不必然被拒绝。）
> 2. **交易 RPC（`SOLANA_TX_RPC_ENDPOINT`）不能是公共 `api.devnet.solana.com`。**
> 3. 启用 indexer 时，**indexer RPC 必须与交易 RPC 不同。**
> 4. 交易 RPC 上 program 账户必须存在且 `executable=true`，且链上 `ProtocolConfig.usdcMint` 必须与 `PILOT_EXPECTED_USDC_MINT` 完全一致。
>
> 以下属于 **Pilot 部署 / 运营策略推荐（非代码 fail-closed 保证）**，用于可靠运行 Pilot，但当前代码并不强制：主/只读 RPC（`SOLANA_RPC_ENDPOINT`）走专用（付费/私有、非公共）devnet endpoint、主 RPC 与交易 RPC 分离、indexer RPC 走非公共 endpoint（避免限流、无 SLA、preflight 超时）。强烈建议按此策略配置，但不要把它们当作代码层的 fail-closed 保证。

- `SOLANA_IS_DEVNET=true`
  - Pilot 必填；标记集群为 devnet。生产 config 与 pre-listen genesis gate 会拒绝任何非 devnet 集群。
- `SOLANA_RPC_ENDPOINT=<devnet primary/read RPC>`
  - 主/只读 RPC，用于账户读取与投影。代码仅强制它通过完整 devnet genesis 校验；**走专用（非公共）devnet endpoint、并与交易 RPC 分离属于运营策略推荐（非代码强制）**，但对可靠的 Pilot 运行强烈建议。
- `SOLANA_TX_RPC_ENDPOINT=<devnet tx RPC>`
  - 交易发送/确认 RPC。代码强制：**不能**用公共 `api.devnet.solana.com`、必须通过完整 devnet genesis 校验；启用 indexer 时 indexer RPC 必须与它不同。生产监听前还会在此 RPC 上确认 program 账户存在且 `executable=true`，并读取链上 `ProtocolConfig.usdcMint` 要求与 `PILOT_EXPECTED_USDC_MINT` 完全一致。与主/只读 RPC 分离属于运营策略推荐（非代码强制）。
- `SOLANA_INDEXER_RPC_ENDPOINT=<devnet indexer RPC>`
  - indexer 日志订阅 RPC。按 Pilot 推荐配置启用 `INDEXER_ENABLED=true` 时（代码默认为 false），代码强制它**独立于交易 RPC**并通过完整 devnet genesis 校验。走非公共（专用）devnet endpoint 以避免 indexer 订阅与交易发送互相争抢/限流，属于运营策略推荐（非代码强制），但强烈建议。
- `STREAMPUMP_PROGRAM_ID`
  - 生产监听前会在交易 RPC 上确认该账户存在且 `executable=true`。
- `PILOT_EXPECTED_USDC_MINT=<Pilot test-USDC mint>`
  - 见上文 invite-only gate：监听前读取链上 `ProtocolConfig.usdcMint` 并要求完全一致，否则 fail-closed。
- `STREAMPUMP_IDL_PATH=../target/idl/streampump_core.json`
  - ⚠️ 见上文「IDL 制品 blocker」：Root Directory 为 `backend` 时该路径指向 `backend` 之外的根 `target/`，不会进入部署制品。真实部署前必须把完整生产 IDL 随后端一起交付并相应调整此路径。
- `ORACLE_AUTHORITY_KEYPAIR_PATH` 或 `ORACLE_AUTHORITY_SECRET_KEY`（仅手动 Track 1 结算用；Pilot 不启用自动调度器）

#### Storage
- `R2_REGION=auto`
- `R2_BUCKET`
- `R2_ENDPOINT`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_PUBLIC_BASE_URL`
- `R2_MAX_ASSET_SIZE_BYTES=104857600`
- `R2_MONTHLY_UPLOAD_LIMIT_BYTES=10737418240`
- `R2_PUBLIC_FEED_USE_SIGNED_URLS=false`
  - 如果 R2 自定义域公开读取暂时返回 `403 AccessDenied`，可临时设为 `true` 让公共 feed 返回 1 小时签名读取 URL
  - 后端运行时配置统一使用 `R2_*` 变量名；底层通过 R2 API 生成 presigned URL

#### Mux
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`
- `MUX_REQUEST_TIMEOUT_MS=20000`

> Pilot 阶段仅关闭 **ORACLE 自动结算调度器**（自动结算对 Pilot 用户关闭；Track 1 由运营人工操作）。Mux reconciliation 属于媒体 corridor 的可见性/恢复能力，不在禁用之列——配置真实 R2/Mux 后，Pilot 建议开启它，以便观察 ingest 队列与 stale 资产。

- `MUX_RECONCILIATION_ENABLED=true`（配置真实 R2/Mux 后开启；无真实 Mux 时保持 `false`）
- `MUX_RECONCILIATION_RUN_ON_BOOT=true`（配置真实 R2/Mux 后开启；无真实 Mux 时保持 `false`）
- `MUX_RECONCILIATION_CRON=*/10 * * * *`
- `MUX_RECONCILIATION_BATCH_SIZE=50`
- `MUX_RECONCILIATION_STALE_MINUTES=5`
- `MUX_RECONCILIATION_MAX_ATTEMPTS=24`

#### Indexer / Oracle
- `INDEXER_ENABLED=true`
  - financial projection 依赖它保持链上状态与投影同步；Pilot 应保持开启。
- `INDEXER_BACKFILL_LIMIT=100`
- `INDEXER_CONSUMER_KEY=streampump_core_logs`
- `ORACLE_SCHEDULER_ENABLED=false`（Pilot 关闭自动结算）
- `ORACLE_RUN_ON_BOOT=false`
- `ORACLE_TRACK1_CRON=0 * * * *`
- `ORACLE_TRACK2_CRON=15 2 * * *`
- `ORACLE_TRACK3_CRON=45 2 * * *`
- `ORACLE_WORKER_BATCH_SIZE=200`
- `ORACLE_RPC_TIMEOUT_MS=25000`

### 2.4 首次上线后执行数据库 migration
Render Web Service 默认不会替你自动做 Prisma deploy migration。

首次上线后，需要在 Render shell 或本地连同一个生产数据库执行：

```bash
cd backend
npm run prisma:migrate:deploy
```

然后再确认：
- `/health` 返回 200
- API 路由能响应

## Step 3：把前端切到线上后端

当 Render backend 有了正式地址之后：

1. 回到 Vercel
2. 更新：
   - `NEXT_PUBLIC_BACKEND_BASE_URL=https://api.yourdomain.com`
3. 重新部署前端

## Step 4：把 Mux webhook 从本地 tunnel 切到正式后端

现在你本地应该还用过 Cloudflare Tunnel。
上云后要切成正式地址。

在 Mux Dashboard 里，把 webhook endpoint 改成：

```text
https://api.yourdomain.com/api/webhooks/mux
```

然后：
1. 确认 `MUX_WEBHOOK_SECRET` 使用的是这个正式 endpoint 对应的 secret
2. 重启或重新部署 backend

## Step 5：生产验证清单

正式切流前，至少按这个顺序验一次：

### 5.1 Backend
1. `GET /health`
2. `POST /api/v1/auth/challenge`
3. `POST /api/v1/auth/verify`
4. `POST /api/v1/content/manifests`
5. `POST /api/v1/content/manifests/:id/assets/presign`

### 5.2 Upload + Video
1. 生成图片上传 presigned URL
2. 生成视频上传 presigned URL
3. 完成视频 upload
4. 观察 Mux webhook 是否回写 `READY`

### 5.3 Launch bundle
1. 创建 `ProposalIntent`
2. `build-bundle`
3. creator partial sign
4. sponsor final sign + submit
5. backend 确认链上状态与 DB projection 一致

### 5.4 Frontend
1. `/explore` 正常
2. `/trending` 正常
3. `/workspace` 正常
4. 前端没有 CORS 报错
5. 外部钱包 challenge/verify 登录可走通（Pilot 关闭 Web3Auth/social/email 登录）

## Step 6：上线后的下一步

当你确认第一阶段可用后，建议继续做这三件事：

1. 把后端拆成 `web` 和 `worker`
2. 加 Redis / queue，把幂等和后台任务做稳
3. 给正式域名配：
   - `app.yourdomain.com`
   - `api.yourdomain.com`

## 推荐的最小上线顺序
1. 先部署 backend 到 Render
2. 确认 `/health` 和 migration
3. 再部署 frontend 到 Vercel
4. 再切 Mux webhook
5. 最后做完整内容上传和 proposal launch 验证

## 备注
- 当前仓库适合先走 `Vercel + Render`，而不是把前后端都塞进同一个 serverless 平台
- 第一阶段保持一个 Render service 没问题
- 真正有流量后，再考虑拆 worker 和引入 Redis
