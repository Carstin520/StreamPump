# AWS media access runbook

StreamPump public feed media currently depends on:

- S3 bucket: `streampump-origin-dev-dongheng`
- CloudFront host: `dhtrwpa2mlguo.cloudfront.net`
- Public object prefix: `content/*`

## Current diagnosis

The objects exist in S3. For example:

- `content/cmo6khq5p0000qtqyu00rw6a8/v/1/0-ad022f4b6c89.jpg`
- `content/cmo6khq5p0000qtqyu00rw6a8/v/1/0-ad022f4b6c89.display.webp`

The backend credentials can `HeadObject` both keys, and a generated S3 signed GET URL returns `206 image/webp` for the display variant. Direct CloudFront reads still return `403 AccessDenied`, so the break is between CloudFront and S3, not missing objects.

The local backend credentials do not have permission to read these account-level settings:

- `s3:GetBucketPolicy`
- `s3:GetBucketPublicAccessBlock`
- `s3:GetBucketOwnershipControls`

To let Codex inspect or repair this directly, grant a temporary operator IAM principal these permissions scoped to the bucket and distribution:

- `s3:GetBucketPolicy`
- `s3:PutBucketPolicy`
- `s3:GetBucketPublicAccessBlock`
- `s3:GetBucketOwnershipControls`
- `s3:GetObject`
- `cloudfront:GetDistribution`
- `cloudfront:GetDistributionConfig`
- `cloudfront:UpdateDistribution`
- `cloudfront:ListOriginAccessControls`
- `cloudfront:CreateOriginAccessControl`
- `cloudfront:CreateInvalidation`

## Temporary production fallback

Until CloudFront origin access is fixed, set this Render backend environment variable and redeploy:

```bash
S3_PUBLIC_FEED_USE_SIGNED_URLS=true
```

This makes public feed responses return one-hour S3 signed GET URLs for origin and `.display.webp` assets. The frontend detects signed URLs and renders them with a native `img`, bypassing Next Image optimizer host restrictions.

Keep these frontend Vercel variables:

```bash
NEXT_PUBLIC_BACKEND_BASE_URL=https://streampump.onrender.com
NEXT_IMAGE_REMOTE_HOSTS=dhtrwpa2mlguo.cloudfront.net
```

## Preferred CloudFront fix

Use CloudFront Origin Access Control (OAC), not public bucket reads:

1. Open CloudFront distribution for `dhtrwpa2mlguo.cloudfront.net`.
2. Confirm the S3 origin points to `streampump-origin-dev-dongheng.s3.us-east-1.amazonaws.com`, not the S3 website endpoint.
3. Attach or create an OAC for the S3 origin.
4. In S3 bucket policy, allow CloudFront to read only the content prefix:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontReadContent",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::streampump-origin-dev-dongheng/content/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::<AWS_ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
        }
      }
    }
  ]
}
```

5. Invalidate CloudFront cache for `/content/*`.
6. Verify:

```bash
curl -I https://dhtrwpa2mlguo.cloudfront.net/content/cmo6khq5p0000qtqyu00rw6a8/v/1/0-ad022f4b6c89.display.webp
```

Expected result: `HTTP/2 200` with `content-type: image/webp`.

After CloudFront returns 200 consistently, set `S3_PUBLIC_FEED_USE_SIGNED_URLS=false` in Render and redeploy the backend.
