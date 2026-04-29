# Vercel + Render Deployment Guide

## 概览
这份文档给出一条最务实的 StreamPump 首次上云路径：

- `app` 部署到 **Vercel**
- `backend` 部署到 **Render**
- 数据库继续用 **Neon**
- 对象存储继续用 **AWS S3**
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

## 部署前检查

在真正点部署按钮前，先确认这些基础资源已经可用：

1. Neon 数据库已经创建
2. AWS S3 bucket 已可读写
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
  - 示例：`https://mainnet.helius-rpc.com/?api-key=...`
  - 或 devnet endpoint
- `NEXT_IMAGE_REMOTE_HOSTS`
  - 示例：`dhtrwpa2mlguo.cloudfront.net`
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

#### Database
- `DATABASE_URL`
- `DIRECT_URL`

#### Solana / Protocol
- `SOLANA_RPC_ENDPOINT`
- `STREAMPUMP_PROGRAM_ID`
- `STREAMPUMP_IDL_PATH=../target/idl/streampump_core.json`
- `ORACLE_AUTHORITY_KEYPAIR_PATH` 或 `ORACLE_AUTHORITY_SECRET_KEY`

#### Storage
- `S3_REGION`
- `S3_BUCKET`
- `S3_ENDPOINT`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `S3_PUBLIC_BASE_URL`
- `S3_PUBLIC_FEED_USE_SIGNED_URLS=false`
  - 如果 CloudFront/S3 公开读取暂时返回 `403 AccessDenied`，可临时设为 `true` 让公共 feed 返回 1 小时签名读取 URL
  - AWS 修复步骤见 [aws-media-access-runbook.md](./aws-media-access-runbook.md)

#### Mux
- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`
- `MUX_WEBHOOK_SECRET`
- `MUX_REQUEST_TIMEOUT_MS=20000`
- `MUX_RECONCILIATION_ENABLED=true`
- `MUX_RECONCILIATION_RUN_ON_BOOT=true`
- `MUX_RECONCILIATION_CRON=*/10 * * * *`
- `MUX_RECONCILIATION_BATCH_SIZE=50`
- `MUX_RECONCILIATION_STALE_MINUTES=5`
- `MUX_RECONCILIATION_MAX_ATTEMPTS=24`

#### Indexer / Oracle
- `INDEXER_ENABLED=true`
- `INDEXER_BACKFILL_LIMIT=100`
- `INDEXER_CONSUMER_KEY=streampump_core_logs`
- `ORACLE_SCHEDULER_ENABLED=true`
- `ORACLE_RUN_ON_BOOT=true`
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
5. 钱包 / Web3Auth 登录可走通

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
