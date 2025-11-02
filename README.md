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
| `CDN_HOST` (optional) | If provided, final URLs are built with this host (e.g. `cdn1.herolokal.my`). |

After installing the plugin, rebuild NodeBB and restart the forum:

```bash
./nodebb activate nodebb-plugin-r2-uploads
./nodebb build
./nodebb restart
```

Uploads will be written directly to the bucket; no post-processing sync job is required.
