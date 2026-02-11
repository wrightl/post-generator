# PostGenerator Function

Azure Function that runs on a **timer** (every 5 minutes) to publish due posts to social platforms. Each platform has its own publisher; if config for a platform is missing, that publisher logs a warning and returns false (the post is marked Failed).

An **HTTP-triggered** function `TriggerPublish` is available so you can run the same publish job on demand (e.g. for local testing without waiting for the timer).

## Running and debugging the Function locally

1. **Start the Function**  
   From VS Code: select the **Function** launch configuration and press F5. Or run `func start` from `src/Function` (ensure Azure Functions Core Tools is installed and Azurite is running if using `UseDevelopmentStorage=true`).

2. **Trigger post sending immediately**  
   Send a POST request to run the publish job:
   ```bash
   curl -X POST "http://localhost:7071/api/TriggerPublish"
   ```
   Use the URL printed by `func start` if it includes a function key, or add `?code=<key>` as required.

3. **Test data**  
   The publish job only processes posts with **Status = Scheduled** and **ScheduledAt** in the past (or now). Create or update a post to Scheduled with a due time, then call the TriggerPublish endpoint.

4. **Debugging**  
   Start the Function (F5 with the **Function** config), then use the **Azure Functions** VS Code extension’s **Attach to .NET Functions** so the debugger attaches to the worker. Set breakpoints in `PublishRunner` or any publisher (e.g. `BlueskyPublisher`, `FacebookPublisher`), then trigger a run with `POST /api/TriggerPublish` to hit them.

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
