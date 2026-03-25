# StreamPump Proposal Launch API Contract

## 1. 文档目标
本合同定义 “DB-First 内容流转 + Chain-First 最终结算 + 单次签名 Proposal Launch” 的后端接口。

目标：

1. Creator 完成内容草稿和冻结。
2. Sponsor 与 Creator 锁定 Proposal 条款。
3. 后端组装一个包含多个 instruction 的 `VersionedTransaction`。
4. Creator 预签一次，Sponsor 最终只签一次。
5. 后端 relay 交易并把链上最终状态同步进 `Proposal`。

## 2. 关键原则

### 2.1 DB-First
以下对象只在 DB 中流转：

- `ContentManifest`
- `ContentAsset`
- `ContentPublication`
- `ProposalIntent`
- `TxBundle`
- 高频事件、点击流、风控信号

### 2.2 Chain-First
以下动作必须以链上结果为准：

- `anchor_content_hash`
- `create_proposal`
- `sponsor_fund`
- `settle_track1_base`
- `settle_track2`
- endorsement 自动结算

### 2.3 UX 铁律
Sponsor 在 proposal launch 阶段只允许看到 1 次签名弹窗。

### 2.4 当前链上约束
当前链上 `create_proposal` 需要 `creator` 签名，[create_proposal.rs](/Users/jamesli/Desktop/Sol%20Projects/StreamPump/programs/streampump-core/src/instructions/create_proposal.rs)。

因此第一版合法流程是：

- Creator 预签一次
- Sponsor 最终签一次
- 同一笔交易原子上链

不是：

- Sponsor 一个人单签完成全部

## 3. 状态机

### 3.1 ContentManifest

```text
DRAFT
  -> UPLOADING
  -> READY
  -> LOCKED
  -> ANCHORED
  -> PUBLISHED
  -> ARCHIVED
```

### 3.2 ProposalIntent

```text
DRAFT
  -> TERMS_LOCKED
  -> BUNDLE_BUILT
  -> CREATOR_PARTIALLY_SIGNED
  -> SPONSOR_SIGNED
  -> SUBMITTED
  -> CONFIRMED
  -> FAILED / EXPIRED
```

### 3.3 TxBundle

```text
BUILT
  -> PARTIAL
  -> FULLY_SIGNED
  -> SUBMITTED
  -> CONFIRMED
  -> FAILED / EXPIRED
```

## 4. 路由清单

建议新增路由文件：

- `backend/src/routes/contentManifestRoutes.ts`
- `backend/src/routes/proposalIntentRoutes.ts`
- `backend/src/routes/txBundleRoutes.ts`
- `backend/src/routes/internalOracleRoutes.ts`

## 5. 通用约束

### 5.1 认证
所有写接口：

- `Authorization: Bearer <jwt>`
- `x-idempotency-key: <uuid>`

### 5.2 返回格式

成功：

```json
{
  "ok": true,
  "data": {}
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "code": "INTENT_ALREADY_LOCKED",
    "message": "proposal intent is already locked"
  }
}
```

## 6. DTO 定义

```ts
export type ContentType = "SHORT_VIDEO" | "IMAGE_CAROUSEL" | "MIXED_MEDIA_NOTE";
export type Track2MetricType = "VIEWS" | "CLICKS" | "SAVES";
export type BundleSubmitMode = "SERVER_RELAY" | "CLIENT_RELAY";

export interface CreateContentManifestRequest {
  contentType: ContentType;
  title?: string | null;
  captionText?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface PresignAssetInput {
  assetType: "IMAGE" | "VIDEO" | "COVER";
  orderIndex: number;
  sha256Hex: string;
  mimeType: string;
  fileSizeBytes: string;
}

export interface PresignAssetsRequest {
  assets: PresignAssetInput[];
}

export interface FinalizeManifestRequest {
  expectedVersion?: number;
}

export interface CreateProposalIntentRequest {
  manifestId: string;
  creatorWallet: string;
  sponsorWallet: string;
  sponsorOrgId?: string | null;
  creatorOrgId?: string | null;
  deadlineUnix: string;
  track1BaseUsdc: string;
  track2MetricType: Track2MetricType;
  track2TargetValue: string;
  track2MinAchievementBps: number;
  track3UsdcDeposited: string;
  track3DelayDays: number;
}

export interface LockProposalIntentRequest {
  expectedIntentVersion?: number;
}

export interface BuildLaunchBundleRequest {
  submitMode: BundleSubmitMode;
}

export interface CreatorPartialSignRequest {
  bundleId: string;
  partiallySignedTxBase64: string;
}

export interface SponsorSubmitRequest {
  bundleId: string;
  fullySignedTxBase64: string;
}
```

## 7. 外部 API 合同

### 7.1 创建内容草稿
`POST /v1/content/manifests`

请求：

```json
{
  "contentType": "MIXED_MEDIA_NOTE",
  "title": "周末探店",
  "captionText": "今天去了一家新咖啡店",
  "tags": ["coffee", "shanghai"]
}
```

响应：

```json
{
  "ok": true,
  "data": {
    "manifestId": "cm_xxx",
    "status": "DRAFT",
    "version": 1
  }
}
```

### 7.2 申请素材上传
`POST /v1/content/manifests/:manifestId/assets/presign`

请求：

```json
{
  "assets": [
    {
      "assetType": "IMAGE",
      "orderIndex": 0,
      "sha256Hex": "abc...",
      "mimeType": "image/jpeg",
      "fileSizeBytes": "12345"
    },
    {
      "assetType": "VIDEO",
      "orderIndex": 1,
      "sha256Hex": "def...",
      "mimeType": "video/mp4",
      "fileSizeBytes": "45678"
    }
  ]
}
```

响应：

```json
{
  "ok": true,
  "data": {
    "manifestId": "cm_xxx",
    "uploads": [
      {
        "assetId": "ca_xxx",
        "storageKey": "content/cm_xxx/0.jpg",
        "presignedUrl": "https://...",
        "expiresInSeconds": 900
      }
    ]
  }
}
```

### 7.3 完成单素材上传
`POST /v1/content/manifests/:manifestId/assets/:assetId/complete`

作用：

- 验证对象存在
- 标记 `uploadStatus = UPLOADED`
- 若是视频则触发 mux
- 不自动上链

### 7.4 冻结 manifest
`POST /v1/content/manifests/:manifestId/finalize`

响应：

```json
{
  "ok": true,
  "data": {
    "manifestId": "cm_xxx",
    "status": "READY",
    "version": 1,
    "manifestHashHex": "7f...",
    "internalCanonicalUrl": "https://api.streampump.xyz/content/manifests/cm_xxx/v/1",
    "internalUrlDigestHex": "8a...",
    "plannedContentAnchorPda": "..."
  }
}
```

### 7.5 登记外部发布映射
`POST /v1/content/publications`

请求：

```json
{
  "manifestId": "cm_xxx",
  "platform": "XHS",
  "externalUrl": "https://www.xiaohongshu.com/explore/...",
  "externalPostId": "6748392929"
}
```

### 7.6 创建 proposal intent
`POST /v1/proposal-intents`

请求：

```json
{
  "manifestId": "cm_xxx",
  "creatorWallet": "creator_pubkey",
  "sponsorWallet": "sponsor_pubkey",
  "deadlineUnix": "1760000000",
  "track1BaseUsdc": "100000",
  "track2MetricType": "VIEWS",
  "track2TargetValue": "1000",
  "track2MinAchievementBps": 5000,
  "track3UsdcDeposited": "300000",
  "track3DelayDays": 45
}
```

响应：

```json
{
  "ok": true,
  "data": {
    "intentId": "pi_xxx",
    "status": "DRAFT"
  }
}
```

### 7.7 锁定条款
`POST /v1/proposal-intents/:intentId/lock`

作用：

- 锁定 `manifest version`
- 计算 `lockedManifestHashHex`
- 读取 `currentAnchorPda`
- 推导 `plannedProposalPda`
- 推导 `plannedUsdcVaultPda`

响应：

```json
{
  "ok": true,
  "data": {
    "intentId": "pi_xxx",
    "status": "TERMS_LOCKED",
    "lockedManifestHashHex": "7f...",
    "lockedAnchorPda": null,
    "plannedProposalPda": "...",
    "plannedUsdcVaultPda": "..."
  }
}
```

### 7.8 组装 Launch Bundle
`POST /v1/proposal-intents/:intentId/build-bundle`

规则：

- 若 manifest 未 anchor：
  - instruction plan = `anchor_content_hash -> create_proposal -> sponsor_fund`
- 若 manifest 已 anchor：
  - instruction plan = `create_proposal -> sponsor_fund`

响应：

```json
{
  "ok": true,
  "data": {
    "bundleId": "tb_xxx",
    "status": "BUILT",
    "versionedTxBase64": "...",
    "requiredSigners": ["creator_pubkey", "sponsor_pubkey"],
    "instructionPlan": [
      "anchor_content_hash",
      "create_proposal",
      "sponsor_fund"
    ],
    "plannedProposalPda": "...",
    "expiresAt": "2026-03-25T10:00:00.000Z"
  }
}
```

### 7.9 Creator 上传部分签名
`POST /v1/proposal-intents/:intentId/creator-partial-sign`

请求：

```json
{
  "bundleId": "tb_xxx",
  "partiallySignedTxBase64": "..."
}
```

响应：

```json
{
  "ok": true,
  "data": {
    "bundleId": "tb_xxx",
    "status": "PARTIAL",
    "intentStatus": "CREATOR_PARTIALLY_SIGNED"
  }
}
```

### 7.10 Sponsor 最终签名并提交
`POST /v1/proposal-intents/:intentId/submit`

请求：

```json
{
  "bundleId": "tb_xxx",
  "fullySignedTxBase64": "..."
}
```

响应：

```json
{
  "ok": true,
  "data": {
    "bundleId": "tb_xxx",
    "status": "SUBMITTED",
    "intentStatus": "SUBMITTED",
    "chainTxSignature": "5x..."
  }
}
```

### 7.11 查询状态
`GET /v1/proposal-intents/:intentId/status`

响应：

```json
{
  "ok": true,
  "data": {
    "intentId": "pi_xxx",
    "intentStatus": "CONFIRMED",
    "bundleStatus": "CONFIRMED",
    "proposalPda": "...",
    "contentAnchorPda": "...",
    "chainTxSignature": "5x..."
  }
}
```

## 8. 内部 Oracle / Batch API

### 8.1 Track2 结算
`POST /internal/oracle/proposals/:proposalPda/settle-track2`

请求：

```json
{
  "actualValue": 800
}
```

### 8.2 fan settlement 批处理入队
`POST /internal/oracle/proposals/:proposalPda/enqueue-endorsement-settlement`

作用：

- 读取全部未结算 endorsement positions
- 生成批处理 job

### 8.3 fan settlement 批量 flush
`POST /internal/oracle/proposals/:proposalPda/flush-endorsement-batch`

请求：

```json
{
  "limit": 10
}
```

作用：

- 每次组装 8-12 个 `claim_endorsement` instruction
- 后端 relay，不需要 endorser 再签名

## 9. 后端服务职责划分

### 9.1 `contentManifestService.ts`
负责：

- 创建 manifest
- 生成 canonical manifest
- 计算 `manifestHashHex`
- 计算 `internalCanonicalUrl`

### 9.2 `proposalIntentService.ts`
负责：

- 创建 intent
- 锁定条款
- 状态迁移校验
- DB 事务

### 9.3 `txBundleService.ts`
负责：

- 构造 instruction plan
- 生成 `VersionedTransaction`
- 写 `TxBundle`
- 处理过期、提交、确认

### 9.4 `AnchorService.ts`
负责：

- PDA derivation
- build instruction
- relay tx
- confirm tx
- settlement RPC

## 10. Build Bundle 的内部流程

### 10.1 输入
- `ProposalIntent`
- `ContentManifest`
- `ContentAsset[]`
- `ProtocolConfig`
- `Sponsor ATA`
- `CreatorProfile PDA`

### 10.2 输出

```ts
interface BuiltLaunchBundle {
  bundleId: string;
  versionedTxBase64: string;
  requiredSigners: string[];
  plannedProposalPda: string;
  plannedContentAnchorPda?: string | null;
  instructionPlan: string[];
  expiresAt: string;
}
```

### 10.3 伪代码

```ts
if (!manifest.currentAnchorPda) {
  ixs.push(buildAnchorContentHashIx(manifest));
}

ixs.push(buildCreateProposalIx(intent, manifest));
ixs.push(buildSponsorFundIx(intent));

const message = new TransactionMessage({
  payerKey: sponsorPublicKey,
  recentBlockhash,
  instructions: ixs,
}).compileToV0Message();

const tx = new VersionedTransaction(message);
```

## 11. 幂等与并发控制

### 11.1 所有写接口必须检查 `x-idempotency-key`
建议新增表：

```prisma
model ApiIdempotencyKey {
  id           String   @id @default(cuid())
  key          String   @unique
  route        String
  requestHash  String
  responseJson Json
  createdAt    DateTime @default(now())
}
```

### 11.2 `ProposalIntent.lock`
必须做 optimistic lock：

- `status == DRAFT`
- `manifest.status in (READY, ANCHORED, PUBLISHED)`

### 11.3 `TxBundle.submit`
必须保证：

- bundle 未过期
- bundle 状态是 `PARTIAL` 或 `FULLY_SIGNED`
- intent 还没 confirmed

## 12. 错误码建议

```ts
type ApiErrorCode =
  | "MANIFEST_NOT_FOUND"
  | "MANIFEST_NOT_READY"
  | "MANIFEST_ALREADY_LOCKED"
  | "INTENT_NOT_FOUND"
  | "INTENT_ALREADY_LOCKED"
  | "INTENT_STATUS_INVALID"
  | "BUNDLE_NOT_FOUND"
  | "BUNDLE_EXPIRED"
  | "BUNDLE_ALREADY_SUBMITTED"
  | "CHAIN_SUBMIT_FAILED"
  | "CHAIN_CONFIRM_TIMEOUT"
  | "WALLET_SIGNATURE_INVALID";
```

## 13. 落地顺序
建议实现顺序：

1. `ContentManifest` API
2. `ProposalIntent` API
3. `txBundleService`
4. `build-bundle`
5. `creator-partial-sign`
6. `submit`
7. `internal oracle settlement batch`

## 14. 与现有文件的改造映射

- 现有 [mediaController.ts](/Users/jamesli/Desktop/Sol%20Projects/StreamPump/backend/src/controllers/mediaController.ts)
  - 保留上传能力
  - 去掉自动 anchor
  - 改成服务 `ContentAsset` 写入

- 现有 [proposalController.ts](/Users/jamesli/Desktop/Sol%20Projects/StreamPump/backend/src/controllers/proposalController.ts)
  - 废弃 `createProposalDraft`
  - 改为 `ProposalIntentController`

- 现有 [AnchorService.ts](/Users/jamesli/Desktop/Sol%20Projects/StreamPump/backend/src/services/AnchorService.ts)
  - 新增 `buildAnchorContentHashIx`
  - 新增 `buildCreateProposalIx`
  - 新增 `buildSponsorFundIx`
  - 新增 `buildProposalLaunchBundle`

## 15. 第一版不做的事情

- 不做 sponsor 单人代替 creator 签名
- 不做跨链消息
- 不做多 sponsor 联合 funding
- 不做前端自动钱包会话恢复

第一版只确保：

- 内容对象稳定
- sponsor 只看到 1 次最终签名
- proposal launch 原子上链

