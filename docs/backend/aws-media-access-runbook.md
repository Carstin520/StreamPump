# Historical AWS media access runbook

This runbook is intentionally archived. StreamPump's current origin object
storage target is **Cloudflare R2**, accessed through the AWS S3-compatible SDK.
Do not use this file for new deployments.

Current deployment guidance lives in:

- `docs/backend/vercel-render-deployment.md`
- `docs/backend/env-and-vendor-guide.md`
- `backend/.env.example`

For the current R2-backed public feed, configure:

```bash
R2_REGION=auto
R2_BUCKET=<bucket>
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=<r2_access_key>
R2_SECRET_ACCESS_KEY=<r2_secret_key>
R2_PUBLIC_BASE_URL=https://<public-r2-domain>
S3_PUBLIC_FEED_USE_SIGNED_URLS=false
```

Frontend image host configuration should point at the same public R2 domain:

```bash
NEXT_IMAGE_REMOTE_HOSTS=<public-r2-domain>
```

The code still accepts `S3_*` aliases for compatibility because the R2 API is
S3-compatible. New environments should prefer `R2_*` variables to avoid
confusion.
