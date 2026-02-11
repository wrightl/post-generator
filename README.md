# Post Generator

AI-powered social media post scheduler. Next.js frontend, .NET 10 API, Azure Functions for scheduled publishing.

## Prerequisites

- .NET 10 SDK
- Node.js 20+
- Docker (for local SQL Server and Azurite storage emulator)
- (Optional) Azure Functions Core Tools for local Function runs

## Quick start

### 1. Database and storage (local)

```bash
docker compose up -d
```

This starts **SQL Server** and **Azurite** (blob, queue, and table on ports 10000–10002). The API and Function use Azurite for local blob storage and Functions runtime storage when running locally.

Then set the connection string for the API (see below). For local dev only, if `ConnectionStrings__DefaultConnection` is not set, the API falls back to a default SQL Server connection; **production must set this** (no default password in code for non-Development).

### 2. API

```bash
cd src/Api
dotnet ef database update   # apply migrations (from Api project)
dotnet watch run
```

`dotnet watch run` watches for file changes and hot-reloads (or restarts) the API when you edit code.

Health: `GET https://localhost:7xxx/health`

### 3. Web

```bash
cd src/Web
npm install
npm run dev
```

### 4. Function (optional, local)

The Function runs on a **timer** (every 5 minutes) to publish due posts. For local testing you can trigger a publish run **immediately** via an HTTP endpoint.

**Run the Function**

- From VS Code: select the **Function** launch configuration and press F5 (builds then runs `func start`).
- Or from a terminal:

    ```bash
    cd src/Function
    func start
    ```

(Requires Azure Functions Core Tools. The Function project targets .NET 10.) With `AzureWebJobsStorage: "UseDevelopmentStorage=true"` in `local.settings.json`, the Function uses Azurite when it is running (e.g. via `docker-compose up -d`).

**Trigger post sending on demand**

- After the Function host has started, send a POST request to trigger the publish job (no need to wait for the timer):

    ```bash
    curl -X POST "http://localhost:7071/api/TriggerPublish"
    ```

    If the host requires a function key, use the URL shown in the `func start` output (it includes the key) or add `?code=<key>` to the URL.

**Testing post sending**

- The publish job only processes posts that are **Scheduled** and **due** (`ScheduledAt <= now`). Ensure you have at least one post in the database with `Status = Scheduled` and `ScheduledAt` in the past (or now), then call the TriggerPublish endpoint above.

**Debugging the Function**

- Start the Function with the **Function** launch config (F5). Install the **Azure Functions** VS Code extension, then use **Run > Attach to .NET Functions** (or the extension’s “Attach to .NET Functions” command). Set breakpoints in `PublishRunner` or any publisher, then trigger a run with `POST /api/TriggerPublish` to hit them.

## Environment and secrets

### Api (`appsettings.json` / env / Azure App Configuration)

| Key                                                            | Description                                                                                                                         |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ConnectionStrings__DefaultConnection`                         | Azure SQL or SQL Server connection string                                                                                           |
| `Firebase__ProjectId`                                          | Firebase project ID                                                                                                                 |
| `Firebase__CredentialPath` or `Firebase__CredentialJsonBase64` | Service account for token verification                                                                                              |
| `Cors__Origins`                                                | Allowed origins (e.g. `["https://yourapp.azurestaticapps.net"]`)                                                                    |
| `AzureOpenAI__Endpoint`                                        | Azure OpenAI endpoint URL                                                                                                           |
| `AzureOpenAI__ApiKey`                                          | Azure OpenAI API key                                                                                                                |
| `AzureOpenAI__ChatDeploymentName`                              | Chat model deployment (e.g. gpt-4o)                                                                                                 |
| `AzureOpenAI__ImageDeploymentName`                             | Image model deployment (e.g. dall-e-3)                                                                                              |
| `BlobStorage__ConnectionString`                                | Azure Storage for generated images. For local dev, Azurite is used; the connection string is set in `appsettings.Development.json`. |
| `BlobStorage__ContainerName`                                   | Container name (default `post-images`)                                                                                              |
| `Mailgun__ApiKey`                                              | Mailgun API key                                                                                                                     |
| `Mailgun__Domain`                                              | Mailgun sending domain                                                                                                              |
| `Mailgun__FromAddress`                                         | From email address                                                                                                                  |

**Local development (API):** Do not commit `appsettings.Development.json`. Use **dotnet user-secrets** for sensitive values: from `src/Api` run e.g. `dotnet user-secrets set "AzureOpenAI:ApiKey" "your-key"`. See [Safe storage of app secrets in development](https://learn.microsoft.com/en-us/aspnet/core/security/app-secrets).

### Web (`.env.local` or build env)

| Key                                        | Description                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`                      | Backend API URL (default dev fallback: `https://localhost:7049` if unset) |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | Firebase web API key                                                      |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Firebase auth domain                                                      |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | Firebase project ID                                                       |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | Optional                                                                  |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Optional                                                                  |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | Optional                                                                  |

**Firebase Auth:** In the [Firebase Console](https://console.firebase.google.com) → Authentication → Sign-in method, enable **Email/Password** (and optionally **Google**, **GitHub**, etc.) so users can create accounts and sign in with all supported providers.

### Function (`local.settings.json` / Azure Function app settings)

| Key                                    | Description                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `AzureWebJobsStorage`                  | Set to `UseDevelopmentStorage=true` for local dev (uses Azurite when running via docker-compose). |
| `ConnectionStrings__DefaultConnection` | Same as Api (Azure SQL)                                                                           |
| `Mailgun__ApiKey`                      | Mailgun API key                                                                                   |
| `Mailgun__Domain`                      | Mailgun domain                                                                                    |
| `Mailgun__FromAddress`                 | From email                                                                                        |

### GitHub Actions CD

Deployment uses GitHub **secrets** and **variables** for API and frontend config; production does not rely on `appsettings.json` or `.env` at deploy time.

**Secrets**

- `AZURE_CREDENTIALS` – JSON from `az ad sp create-for-rbac` (for login).
- `SQL_ADMIN_PASSWORD` – Password for the Azure SQL Server administrator (used by provision; required for full deploy).
- `FIREBASE_CREDENTIAL_JSON_BASE64` – Base64-encoded Firebase service account JSON (API auth).
- `MAILGUN_API_KEY` – Mailgun API key (API and Function).

**Variables** (optional)

- `RESOURCE_GROUP` – e.g. `rg-postgenerator-prod` (default: `rg-postgenerator-dev`).
- `LOCATION` – Azure region for the resource group (default: `westeurope`).
- `AZURE_AI_LOCATION` – Region for the GPT-4o (chat) Azure OpenAI account (default: `westeurope`).
- `AZURE_IMAGE_LOCATION` – Region for the DALL-E-3 (image) Azure OpenAI account (default: `swedencentral`).
- `AZURE_SQL_ADMIN_LOGIN` – SQL Server admin login (default: `sqladmin`).
- **API (Bicep → Container App / Function):** `FIREBASE_PROJECT_ID`, `CORS_ORIGINS` (comma-separated), `MAILGUN_DOMAIN`, `MAILGUN_FROM_ADDRESS`, `MAILGUN_FROM_NAME`.
- **Frontend (build):** `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`. `NEXT_PUBLIC_API_URL` is set from deploy output.

After provision and API/Function deploy, a **deploy_web** job builds the Next.js frontend (static export) with `NEXT_PUBLIC_API_URL` set to the API URL and deploys it to the provisioned **Azure Static Web App** (Free tier). No manual steps are needed; the frontend URL is available from the Static Web App in the Azure portal (or from the workflow’s **Deploy frontend to Static Web Apps** step output `static_web_app_url`).

## Solution layout

- `src/Core` – Shared library (enums, Mailgun abstraction, DTOs) used by Api and Function
- `src/Api` – ASP.NET Core Web API (.NET 10), EF Core, Azure SQL
- `src/Web` – Next.js (App Router, TypeScript)
- `src/Function` – Azure Function (timer: publish scheduled posts), .NET 10

**Deployment:** CD (`.github/workflows/cd.yml`) deploys the Api (Azure Container Apps) and the Function (zip to Function App). The Web app can be deployed separately (e.g. Azure Static Web Apps or any static host); set `NEXT_PUBLIC_API_URL` to your API URL.
