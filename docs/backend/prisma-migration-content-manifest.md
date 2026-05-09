# StreamPump 后端 Prisma Migration 草案

## 1. 文档目标
本草案定义 StreamPump 在 `Pragmatic Web2.5 Hybrid Architecture` 原则下的内容层数据模型升级方案。

目标只有三个：

1. 把现有 `VideoContent` 升级为可表达“小红书式短视频 / 图文 / 混排笔记”的 `ContentManifest` 体系。
2. 把链上最终 Proposal 和链下业务草稿解耦，新增 `ProposalIntent` 与 `TxBundle`。
3. 保持迁移过程可灰度、可回滚，不要求一次性重写全部后端。

## 2. 当前问题
当前 [schema.prisma](../../backend/prisma/schema.prisma) 的核心问题：

- `VideoContent` 只能表达单视频，不适合图文轮播和混排笔记。
- `Proposal` 在链上确认前就被创建，导致 DB 和链上真相源混淆。
- 没有 `manifest version`，无法锁定某次 sponsor 购买的内容版本。
- 没有 `transaction bundle` 状态机，无法承接“creator 预签 + sponsor 单签 + 后端 relay”。

## 3. 目标模型总览

### 3.1 角色定位
- `ContentManifest`：内容包的规范化定义，存图文/视频组合和正文摘要。
- `ContentAsset`：每个素材的独立记录。
- `ContentPublication`：内容在外部平台的映射和验证状态。
- `ProposalIntent`：链下业务草稿，未上链前只存在这里。
- `TxBundle`：单次签名 proposal launch 的交易封装。
- `Proposal`：链上确认后的最终投影，不再承担草稿职责。

### 3.2 新老模型关系
- `VideoContent`：保留一段过渡期，只做兼容读写。
- `ContentManifest`：取代 `VideoContent` 成为内容真相源。
- `ProposalIntent`：新建。
- `Proposal`：继续保留，但只在链上确认后写入或更新。

## 4. 目标 Prisma Schema

```prisma
enum ContentType {
  SHORT_VIDEO
  IMAGE_CAROUSEL
  MIXED_MEDIA_NOTE
}

enum ContentManifestStatus {
  DRAFT
  UPLOADING
  READY
  LOCKED
  ANCHORED
  PUBLISHED
  ARCHIVED
}

enum AssetType {
  IMAGE
  VIDEO
  COVER
}

enum AssetUploadStatus {
  PENDING
  UPLOADED
  FAILED
}

enum AssetProcessingStatus {
  NONE
  PREPARING
  READY
  ERRORED
}

enum ProposalIntentStatus {
  DRAFT
  TERMS_LOCKED
  BUNDLE_BUILT
  CREATOR_PARTIALLY_SIGNED
  SPONSOR_SIGNED
  SUBMITTED
  CONFIRMED
  FAILED
  EXPIRED
}

enum BundleStatus {
  BUILT
  PARTIAL
  FULLY_SIGNED
  SUBMITTED
  CONFIRMED
  FAILED
  EXPIRED
}

enum BundleSubmitMode {
  SERVER_RELAY
  CLIENT_RELAY
}

model ContentManifest {
  id                    String   @id @default(cuid())
  creatorWallet         String
  contentType           ContentType
  status                ContentManifestStatus @default(DRAFT)
  version               Int      @default(1)

  title                 String?
  captionText           String?
  captionTextHash       String?
  tagsJson              Json?
  metadataJson          Json?

  canonicalManifestJson Json
  manifestHashHex       String   @unique
  internalCanonicalUrl  String   @unique
  internalUrlDigestHex  String

  currentAnchorPda      String?
  currentAnchorTx       String?

  coverAssetId          String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  assets                ContentAsset[]
  publications          ContentPublication[]
  proposalIntents       ProposalIntent[]
  proposals             Proposal[]

  @@index([creatorWallet, status])
  @@index([creatorWallet, version])
}

model ContentAsset {
  id                 String   @id @default(cuid())
  manifestId         String
  manifest           ContentManifest @relation(fields: [manifestId], references: [id], onDelete: Cascade)

  assetType          AssetType
  orderIndex         Int
  sha256Hex          String
  mimeType           String
  fileSizeBytes      BigInt
  width              Int?
  height             Int?
  durationMs         Int?

  storageKey         String   @unique
  cdnUrl             String?
  muxAssetId         String?  @unique
  muxPlaybackId      String?  @unique
  uploadStatus       AssetUploadStatus @default(PENDING)
  processingStatus   AssetProcessingStatus @default(NONE)
  processingError    String?

  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  @@unique([manifestId, orderIndex])
  @@index([manifestId, assetType])
}

model ContentPublication {
  id                  String   @id @default(cuid())
  manifestId          String
  manifest            ContentManifest @relation(fields: [manifestId], references: [id], onDelete: Cascade)

  platform            String
  externalPostIdHash  String?
  externalUrl         String
  externalUrlDigestHex String
  verificationStatus  String
  verificationSource  String?
  verifiedAt          DateTime?

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@unique([platform, externalUrl])
  @@index([manifestId, platform, verificationStatus])
}

model ProposalIntent {
  id                      String   @id @default(cuid())
  status                  ProposalIntentStatus @default(DRAFT)

  creatorWallet           String
  sponsorWallet           String
  sponsorOrgId            String?
  creatorOrgId            String?

  manifestId              String
  manifest                ContentManifest @relation(fields: [manifestId], references: [id])

  lockedManifestHashHex   String
  lockedAnchorPda         String?
  deadlineUnix            BigInt

  track1BaseUsdc          BigInt
  track2MetricType        Track2MetricType
  track2TargetValue       BigInt
  track2MinAchievementBps Int
  track3UsdcDeposited     BigInt
  track3DelayDays         Int

  plannedProposalPda      String?
  plannedUsdcVaultPda     String?
  creatorApprovedAt       DateTime?
  sponsorApprovedAt       DateTime?
  chainTxSignature        String?
  chainSubmittedAt        DateTime?
  chainConfirmedAt        DateTime?
  failureReason           String?

  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt

  proposal                Proposal?
  txBundles               TxBundle[]

  @@index([creatorWallet, status])
  @@index([sponsorWallet, status])
  @@index([manifestId, status])
}

model TxBundle {
  id                    String   @id @default(cuid())
  intentId              String
  intent                ProposalIntent @relation(fields: [intentId], references: [id], onDelete: Cascade)

  bundleType            String
  instructionPlanJson   Json
  messageBase64         String
  partiallySignedBase64 String?
  fullySignedBase64     String?

  recentBlockhash       String
  lastValidBlockHeight  BigInt
  requiredSignersJson   Json
  expiresAt             DateTime

  submitMode            BundleSubmitMode
  status                BundleStatus @default(BUILT)
  chainTxSignature      String?
  errorMessage          String?

  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt

  @@index([intentId, status])
  @@index([expiresAt, status])
}
```

## 5. 对现有 `Proposal` 的兼容改造
现有 `Proposal` 不删，继续保留为链上 confirmed projection，但应新增以下字段：

```prisma
model Proposal {
  id                       String   @id @default(cuid())
  proposalPda              String   @unique

  manifestId               String?
  manifest                 ContentManifest? @relation(fields: [manifestId], references: [id], onDelete: SetNull)

  intentId                 String?  @unique
  intent                   ProposalIntent? @relation(fields: [intentId], references: [id], onDelete: SetNull)

  lockedManifestHashHex    String?
  lockedAnchorPda          String?
  launchBundleId           String?

  // 其余保留当前字段
}
```

规则：

- `ProposalIntent` 创建时，不创建 `Proposal`。
- 只有链上 launch tx confirmed 后，才 upsert `Proposal`。
- `Proposal.intentId` 用于把链下 intent 和链上最终 proposal 一一绑定。

## 6. 迁移分阶段执行

### Phase 1: Additive Migration
只加表，不删旧表。

执行内容：

1. 新增 enums。
2. 新增 `ContentManifest` / `ContentAsset` / `ContentPublication` / `ProposalIntent` / `TxBundle`。
3. 给 `Proposal` 增加 `manifestId` / `intentId` / `lockedManifestHashHex` / `lockedAnchorPda` / `launchBundleId`。
4. 保持 `VideoContent` 不变。

迁移文件建议名：

- `202603260001_add_content_manifest_and_proposal_intent`

### Phase 2: Backfill
把旧 `VideoContent` 回填为 `ContentManifest`。

回填规则：

- 每条 `VideoContent` 生成一个 `ContentManifest`
  - `contentType = SHORT_VIDEO`
  - `status`
    - `PENDING -> UPLOADING`
    - `UPLOADED -> READY`
  - `version = 1`
  - `manifestHashHex = video.contentHash`
  - `canonicalManifestJson.assets = [video]`
- 每条 `VideoContent` 生成一个 `ContentAsset`
  - `assetType = VIDEO`
  - `orderIndex = 0`
  - `sha256Hex = video.contentHash`
  - `storageKey = video.r2ObjectKey`
- 若 `VideoContent.proposalId` 非空，则把新 manifest 关联到对应 `Proposal`

迁移脚本建议位置：

- `backend/scripts/backfillVideoContentToManifest.ts`

### Phase 3: Read Switch
接口开始优先读取：

- `ContentManifest`
- `ContentAsset`
- `ProposalIntent`

旧接口仍兼容写 `VideoContent`，但内部同步写 manifest。

### Phase 4: Write Switch
新写入全部切到：

- `ContentManifest`
- `ProposalIntent`

`VideoContent` 进入只读兼容模式。

### Phase 5: Deprecate
确认没有旧流量后，删除：

- `VideoContent.proposalId`
- 旧 proposal draft 逻辑
- 依赖 `videoId` 的 proposal 创建入口

## 7. Canonical Manifest Hash 规则
`manifestHashHex` 必须是规范化 JSON 的 hash，不允许客户端随便传。

后端统一函数：

```ts
function buildCanonicalManifest(input: {
  contentType: "SHORT_VIDEO" | "IMAGE_CAROUSEL" | "MIXED_MEDIA_NOTE";
  captionText?: string | null;
  tags?: string[];
  assets: Array<{
    assetType: "IMAGE" | "VIDEO" | "COVER";
    orderIndex: number;
    sha256Hex: string;
    mimeType: string;
    fileSizeBytes: string;
    durationMs?: number | null;
  }>;
}) => CanonicalManifestV1
```

输出固定字段顺序：

```json
{
  "version": 1,
  "contentType": "MIXED_MEDIA_NOTE",
  "captionTextHash": "sha256_hex",
  "tags": ["coffee", "travel"],
  "assets": [
    {
      "assetType": "IMAGE",
      "orderIndex": 0,
      "sha256Hex": "...",
      "mimeType": "image/jpeg",
      "fileSizeBytes": "12345"
    }
  ]
}
```

然后：

- `manifestHashHex = sha256(canonicalJsonUtf8)`
- `internalCanonicalUrl = https://api.streampump.xyz/content/manifests/{manifestId}/v/{version}`
- `internalUrlDigestHex = keccak256(internalCanonicalUrl)`

## 8. 建议保留的现有表
以下表继续保留：

- `Proposal`
- `Track2Event`

但责任会改变：

- `Proposal`：链上 confirmed projection
- `Track2Event`：继续做高频行为 cache / anti-cheat 输入

## 9. 不建议现在就做的事
这几个点先不要写进第一版 migration：

- 把 `ContentAsset` 的全部 hash 明细再上链
- 为每个素材单独建链上 PDA
- 把 `Track2Event` 直接塞进 proposal metadata
- 把 MCN / Sponsor Organization 全量搬进这次 migration

第一版目标只做：

- 内容对象可表达
- proposal 草稿和最终链上状态解耦
- 单次签名 bundle 有稳定落点

## 10. 实施顺序
建议实际开发顺序：

1. 先落 Phase 1 migration。
2. 先写 `ContentManifestService` 和 canonical hash builder。
3. 再写 `ProposalIntentService`。
4. 最后改 `proposalController` 和 `mediaController`。

## 11. 本文对应后续实现文件
建议后续新增文件：

- `backend/src/services/contentManifestService.ts`
- `backend/src/services/proposalIntentService.ts`
- `backend/src/services/txBundleService.ts`
- `backend/scripts/backfillVideoContentToManifest.ts`
