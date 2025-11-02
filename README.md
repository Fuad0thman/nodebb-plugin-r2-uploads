# nodebb-plugin-r2-uploads

Minimal NodeBB storage plugin that streams uploads straight to a Cloudflare R2 bucket (or any S3-compatible endpoint) and returns CDN URLs immediately.

## Configuration

The plugin relies on environment variables supplied to the NodeBB container:

| Variable | Description |
| --- | --- |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | R2 (or S3) access credentials. |
| `S3_UPLOADS_BUCKET` | Target bucket name, e.g. `cdn1-herolokal`. |
| `S3_UPLOADS_PATH` | Optional prefix inside the bucket (`files/` by default). |
| `S3_ENDPOINT` or `AWS_ENDPOINT_URL_S3` | Custom endpoint such as `https://cf******.r2.cloudflarestorage.com`. |
| `S3_ENDPOINT_REGION` | Region (R2 can use `auto`). |
| `AWS_S3_FORCE_PATH_STYLE` | Set to `true` for R2 compatibility. |
| `CDN_HOST` | Public hostname to emit in final URLs (e.g. `cdn1.herolokal.my`). |

The plugin also honours `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_REGION`, `R2_UPLOADS_PATH`, and `R2_PUBLIC_BASE` if you prefer those names; they override the `S3_*` equivalents.

## Docker Compose snippet

Minimal environment block for the `nodebb` service:

```yaml
environment:
  NODE_ENV: "production"
  NODEBB_URL: "https://komuniti.herolokal.my"

  AWS_ACCESS_KEY_ID: "<your-access-key>"
  AWS_SECRET_ACCESS_KEY: "<your-secret-key>"
  S3_ENDPOINT: "your-account-id.r2.cloudflarestorage.com"
  S3_ENDPOINT_REGION: "auto"
  S3_UPLOADS_BUCKET: "your-bucket"
  S3_UPLOADS_PATH: "files/"
  CDN_HOST: "cdn.example.com"
  AWS_S3_FORCE_PATH_STYLE: "true"

  # optional aliases – override the S3_* values when present
  R2_ACCESS_KEY_ID: "<your-access-key>"
  R2_SECRET_ACCESS_KEY: "<your-secret-key>"
  R2_ENDPOINT: "https://your-account-id.r2.cloudflarestorage.com"
  R2_REGION: "auto"
  R2_UPLOADS_PATH: "files/"
  R2_PUBLIC_BASE: "https://cdn.example.com"
```

Keep the standard NodeBB upload mount so the composer is satisfied (even though the plugin bypasses it):

```yaml
volumes:
  - /srv/komuniti/uploads-live:/usr/src/app/public/uploads
```

## Installation steps

1. Copy the plugin directory into the container (e.g. `docker cp nodebb-plugin-r2-uploads nodebb:/usr/src/app/nodebb-plugin-r2-uploads`).
2. Install and rebuild inside the container:
   ```bash
   npm install --save ./nodebb-plugin-r2-uploads
   ./nodebb build
   ```
3. Activate and restart NodeBB:
   ```bash
   ./nodebb activate nodebb-plugin-r2-uploads
   ./nodebb restart
   ```

Uploads will be written directly to the R2 bucket; no post-processing sync job is required. The plugin returns URLs of the form `https://cdn1.herolokal.my/files/<uid>/<uuid>.<ext>` so each user’s uploads remain isolated.
