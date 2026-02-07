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
docker-compose up -d
```

This starts **SQL Server** and **Azurite** (blob, queue, and table on ports 10000–10002). The API and Function use Azurite for local blob storage and Functions runtime storage when running locally.

Then set the connection string for the API (see below). For local dev only, if `ConnectionStrings__DefaultConnection` is not set, the API falls back to a default SQL Server connection; **production must set this** (no default password in code for non-Development).

### 2. API

```bash
cd src/Api
dotnet ef database update   # apply migrations (from Api project)
dotnet run
```

Health: `GET https://localhost:7xxx/health`

### 3. Web

```bash
cd src/Web
npm install
npm run dev
```

### 4. Function (optional, local)

```bash
cd src/Function
func start
```

(Requires Azure Functions Core Tools. The Function project targets .NET 10.) With `AzureWebJobsStorage: "UseDevelopmentStorage=true"` in `local.settings.json`, the Function uses Azurite when it is running (e.g. via `docker-compose up -d`).

## Environment and secrets

### Api (`appsettings.json` / env / Azure App Configuration)

| Key | Description |
|-----|-------------|
| `ConnectionStrings__DefaultConnection` | Azure SQL or SQL Server connection string |
| `Firebase__ProjectId` | Firebase project ID |
| `Firebase__CredentialPath` or `Firebase__CredentialJsonBase64` | Service account for token verification |
| `Cors__Origins` | Allowed origins (e.g. `["https://yourapp.azurestaticapps.net"]`) |
| `AzureOpenAI__Endpoint` | Azure OpenAI endpoint URL |
| `AzureOpenAI__ApiKey` | Azure OpenAI API key |
| `AzureOpenAI__ChatDeploymentName` | Chat model deployment (e.g. gpt-4o) |
| `AzureOpenAI__ImageDeploymentName` | Image model deployment (e.g. dall-e-3) |
| `BlobStorage__ConnectionString` | Azure Storage for generated images. For local dev, Azurite is used; the connection string is set in `appsettings.Development.json`. |
| `BlobStorage__ContainerName` | Container name (default `post-images`) |
| `Mailgun__ApiKey` | Mailgun API key |
| `Mailgun__Domain` | Mailgun sending domain |
| `Mailgun__FromAddress` | From email address |

### Web (`.env.local` or build env)

| Key | Description |
|-----|-------------|
| `NEXT_PUBLIC_API_URL` | Backend API URL (default dev fallback: `https://localhost:7049` if unset) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Optional |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Optional |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Optional |

**Firebase Auth:** In the [Firebase Console](https://console.firebase.google.com) → Authentication → Sign-in method, enable **Email/Password** (and optionally **Google**, **GitHub**, etc.) so users can create accounts and sign in with all supported providers.

### Function (`local.settings.json` / Azure Function app settings)

| Key | Description |
|-----|-------------|
| `AzureWebJobsStorage` | Set to `UseDevelopmentStorage=true` for local dev (uses Azurite when running via docker-compose). |
| `ConnectionStrings__DefaultConnection` | Same as Api (Azure SQL) |
| `Mailgun__ApiKey` | Mailgun API key |
| `Mailgun__Domain` | Mailgun domain |
| `Mailgun__FromAddress` | From email |

### GitHub Actions CD secrets

- `AZURE_CREDENTIALS` – JSON from `az ad sp create-for-rbac` (for login).
- `ACR_NAME` – Azure Container Registry name.
- `ACR_LOGIN_SERVER` – ACR login server URL.
- `RESOURCE_GROUP` – Azure resource group.
- `API_APP_NAME` – Container App name for the API.
- `FUNCTION_APP_NAME` – Function App name.

## Solution layout

- `src/Core` – Shared library (enums, Mailgun abstraction, DTOs) used by Api and Function
- `src/Api` – ASP.NET Core Web API (.NET 10), EF Core, Azure SQL
- `src/Web` – Next.js (App Router, TypeScript)
- `src/Function` – Azure Function (timer: publish scheduled posts), .NET 10

**Deployment:** CD (`.github/workflows/cd.yml`) deploys the Api (Azure Container Apps) and the Function (zip to Function App). The Web app can be deployed separately (e.g. Azure Static Web Apps or any static host); set `NEXT_PUBLIC_API_URL` to your API URL.
