# PostGenerator Function

Azure Function that runs on a timer to publish due posts to social platforms. Each platform has its own publisher; if config for a platform is missing, that publisher logs a warning and returns false (the post is marked Failed).

## Connection and mail

- **ConnectionStrings__DefaultConnection** – SQL Server connection string for Posts/Users.
- Mailgun (or equivalent) is configured via the `MailgunService` dependencies for sending “post published” emails.

## Publisher app settings

Set these in `local.settings.json` (Values) or Azure Function app settings. All keys are optional per platform; omit a platform’s keys to leave it disabled.

### LinkedIn (Platform 0)

| Key | Required | Description |
|-----|----------|-------------|
| `LinkedIn:AccessToken` | Yes | OAuth2 access token with `w_member_social` scope. |
| `LinkedIn:PersonUrn` | No | Person URN (e.g. `urn:li:person:...`). If omitted, the app calls `/v2/me` to resolve the author. |

### Skool (Platform 1)

Create-post is not in the current Skool API. When/if it is, use:

| Key | Required | Description |
|-----|----------|-------------|
| `Skool:ApiKey` | Yes | API key (sent as `x-api-secret`). |
| `Skool:SessionId` | Yes | Active session ID. |
| `Skool:GroupId` | Yes | Group ID for the post. |

Until then, Skool posts are skipped and marked failed.

### Instagram (Platform 2)

| Key | Required | Description |
|-----|----------|-------------|
| `Instagram:UserId` | Yes | Instagram Business account ID (IG user id). |
| `Instagram:AccessToken` | Yes | Graph API access token with content publish permissions. |

### Bluesky (Platform 3)

| Key | Required | Description |
|-----|----------|-------------|
| `Bluesky:Handle` | Yes | Handle (e.g. `user.bsky.social`). |
| `Bluesky:AppPassword` | Yes | App password. |
| `Bluesky:PdsUrl` | No | PDS base URL (default: `https://bsky.social`). |

### Facebook (Platform 4)

| Key | Required | Description |
|-----|----------|-------------|
| `Facebook:PageId` | Yes | Page ID. |
| `Facebook:PageAccessToken` | Yes | Page access token for posting. |

### TikTok (Platform 5)

| Key | Required | Description |
|-----|----------|-------------|
| `TikTok:AccessToken` | Yes | User access token with `video.upload` scope. |
| `TikTok:AppKey` | No | For app-level auth if needed. |
| `TikTok:AppSecret` | No | For app-level auth if needed. |

TikTok posts require a video URL. Provide it in post `MetadataJson` as `{"video_url": "https://..."}` (domain must be verified with TikTok), or set `ImageUrl` to the video URL. Text-only posts are not supported; the publisher will skip and return false.
