# Private Backend Network, Material Upload, and SkillHub Import Flow

## Context

Current branch: `feat/network-private-profile`

The Azure deployment supports a `privateBackend` network profile:

- Frontend Container App keeps public ingress.
- Backend Container App uses internal ingress.
- Container Apps Environment is integrated with a VNet.
- Storage Blob, PostgreSQL, Key Vault, and Foundry data-plane can be reached through private endpoints and private DNS.

The key mental model is: backend is not exposed as a VM-like fixed private IP. Frontend reaches backend through the Container Apps internal ingress endpoint/FQDN.

## Container Apps private networking model

In this profile, the Container Apps Environment is integrated with the VNet delegated subnet:

```text
VNet
  snet-container-apps
    Container Apps Environment
      frontend app: public ingress
      backend app: internal ingress

  snet-private-endpoints
    Storage Blob private endpoint
    PostgreSQL private endpoint
    Key Vault private endpoint
    Foundry private endpoint
```

Important distinction:

| Address / endpoint | Meaning |
|---|---|
| Backend internal FQDN | Stable address frontend nginx uses, e.g. `ca-...-backend.internal.<env>.azurecontainerapps.io` |
| Backend internal ingress IP/VIP | Container Apps environment internal ingress/load-balancing endpoint; not a backend replica IP |
| Backend replica IP | Platform-managed and dynamic; do not depend on it |
| Backend outbound source IP | Source used when backend calls private endpoints; not the same thing as the internal ingress VIP |
| Blob private endpoint IP | Private Endpoint NIC IP in the private endpoint subnet |

So frontend-to-backend and backend-to-Blob use different network roles:

```text
frontend nginx
  -> backend internal FQDN
  -> Container Apps internal ingress
  -> backend replica

backend replica
  -> VNet outbound path
  -> Blob private endpoint IP
```

## Browser to backend flow

The browser does not call the private backend directly.

```text
Admin browser
  -> public frontend Container App
  -> frontend nginx /api reverse proxy
  -> backend internal ingress FQDN
  -> backend Container App
```

Frontend code uses `/api/v1` as the API base path. In Azure, nginx proxies `/api/` to `BACKEND_URL`, which is set to the backend Container App internal FQDN.

This is why the backend can be private while the browser still uses the application normally: the public boundary is frontend only.

## Backend to Blob private endpoint flow

Backend still uses the normal Blob service URL:

```text
https://<storage-account>.blob.core.windows.net/
```

In `privateBackend`, private DNS makes this hostname resolve privately from inside the VNet:

```text
backend
  -> <storage-account>.blob.core.windows.net
  -> privatelink.blob.core.windows.net private DNS
  -> Blob private endpoint private IP
  -> Azure Storage Blob
```

Authentication is separate from networking:

- Network path: VNet + private DNS + Blob private endpoint.
- Identity path: backend user-assigned managed identity + Storage Blob RBAC.

The backend storage implementation uses `DefaultAzureCredential` when no storage connection string is configured, so Container Apps uses the managed identity to access Blob.

## Admin material upload flow

Material upload is not browser-to-Blob direct upload. The file goes through backend.

```text
Admin browser
  -> public frontend Container App
  -> frontend nginx /api/v1/materials
  -> backend internal ingress
  -> backend validates file
  -> backend writes file to Blob through private endpoint
  -> backend writes material/version metadata to PostgreSQL through private endpoint
```

Backend API:

```text
POST /api/v1/materials
```

Allowed material extensions:

- `.pdf`
- `.docx`
- `.xlsx`

Material upload size limit:

- 4 MB per uploaded material file for the current single-request upload path.
- Larger files require a chunked upload flow; the old 50 MB application-level target cannot be reached reliably through Azure Container Apps ingress with one multipart request.

Blob storage path:

```text
materials/{material_id}/v{version_number}/{filename}
```

Download/preview is the reverse path:

```text
Admin browser
  -> frontend /api/v1/materials/{material_id}/versions/{version_id}/download
  -> nginx proxy
  -> backend internal ingress
  -> backend reads Blob through private endpoint
  -> backend returns bytes to browser
```

## SkillHub: create skill from existing materials

This flow uses already-uploaded material files. Therefore it does use Blob private endpoint access.

```text
Admin browser
  -> public frontend Container App
  -> frontend nginx /api/v1/skills/create-from-agent
  -> backend internal ingress
  -> backend reads material files from Blob through private endpoint
  -> backend copies them to skill resource paths in Blob through private endpoint
  -> backend writes Skill, SkillSourceMaterial, and SkillResource metadata to PostgreSQL
  -> backend starts agent-based skill creation in background
```

Backend API:

```text
POST /api/v1/skills/create-from-agent
```

Request body:

```json
{
  "material_ids": ["..."],
  "name": "New Skill",
  "product": ""
}
```

The copied skill resource path is:

```text
skills/{skill_id}/references/{filename}
```

Size behavior:

- This flow depends on existing uploaded materials.
- Existing material upload limit is currently 4 MB per material file for the single-request upload path.

## SkillHub: import ZIP package

ZIP import is different from material upload and create-from-materials.

```text
Admin browser
  -> public frontend Container App
  -> frontend nginx /api/v1/skills/import
  -> backend internal ingress
  -> backend reads ZIP into memory
  -> backend validates and parses ZIP
  -> backend creates Skill and SkillResource DB records
  -> backend writes metadata to PostgreSQL private endpoint
```

Backend API:

```text
POST /api/v1/skills/import
```

Current behavior:

- ZIP import does not save the ZIP file itself to Blob.
- ZIP import does not save extracted resources to Blob.
- It reads resource entries and stores them as `SkillResource.text_content` in the database.
- The `storage_path` field is populated logically, but `storage.save()` is not called by ZIP import.

ZIP import limits:

| Limit | Value |
|---|---:|
| Compressed ZIP size | 100 MB |
| Total uncompressed size | 100 MB |
| Single ZIP entry size | 50 MB |
| Entry count | 500 |
| Path depth | 5 levels |

Required structure:

```text
SKILL.md
references/...
scripts/...
assets/...
```

`SKILL.md` must exist at the ZIP root.

Allowed top-level directories:

- `references`
- `scripts`
- `assets`

Allowed file extensions inside ZIP:

- `.md`
- `.txt`
- `.pdf`
- `.docx`
- `.pptx`
- `.py`
- `.json`
- `.yaml`
- `.yml`
- `.csv`
- `.png`
- `.jpg`
- `.jpeg`
- `.svg`
- `.gif`

Security checks reject:

- invalid ZIP format
- path traversal with `..`
- absolute paths
- symlinks
- disallowed file extensions
- disallowed top-level directories
- too many files
- too-large compressed or uncompressed content
- duplicate skill names

## SkillHub: upload resources and convert

There is also a direct upload-and-convert flow for an existing skill.

```text
Admin browser
  -> public frontend Container App
  -> frontend nginx /api/v1/skills/{skill_id}/upload-and-convert
  -> backend internal ingress
  -> backend writes uploaded files to Blob through private endpoint
  -> backend writes SkillResource metadata to PostgreSQL
  -> backend starts agent-based conversion in background
```

Backend API:

```text
POST /api/v1/skills/{skill_id}/upload-and-convert
```

Limits:

| Limit | Value |
|---|---:|
| Files per upload request | 10 |
| Single file size | 4 MB |
| Total resources per skill | 100 |

Allowed extensions:

- `.pdf`
- `.docx`
- `.pptx`
- `.txt`
- `.md`
- `.py`
- `.json`
- `.csv`
- `.xlsx`

Blob storage path:

```text
skills/{skill_id}/references/{filename}
```

## Summary

In private networking:

- Public users only reach the frontend Container App.
- Frontend nginx proxies API calls to backend internal ingress.
- Backend is private and should be addressed by internal FQDN, not by a fixed backend container IP.
- Backend accesses Blob/PostgreSQL through private DNS and private endpoints.
- Material upload and upload-and-convert write files to Blob through backend.
- Create-from-materials reads and copies Blob files through backend.
- Skill ZIP import currently imports data into the database and does not write extracted files to Blob.
