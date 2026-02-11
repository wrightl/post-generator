# Azure infrastructure

Infrastructure and deployment use **Azure Developer CLI (azd)**. The CD workflow runs `azd provision` and `azd deploy` on push to `main`. Local development uses the same Bicep with a `localDevOnly` parameter to provision only Azure OpenAI.

## Resources

- **Resource group** – Created by the workflow or deploy-local script (name/location from vars/env or defaults).
- **Log Analytics** – For Container Apps logs (full deploy only).
- **ACR** – Container registry for the API image (full deploy only).
- **Storage** – For the Function App (consumption) and blob storage (full deploy only). A **blob container** `post-images` is created; the API gets `BlobStorage__ConnectionString` and `BlobStorage__ContainerName` from the provisioned storage.
- **Azure SQL** – SQL Server and database `postgenerator` (full deploy only). The API and Function get `ConnectionStrings__DefaultConnection` from provision. Run EF migrations (e.g. `dotnet ef database update` from `src/Api`) against the production connection string after first deploy.
- **Azure OpenAI** – For full deploy: two Cognitive Services accounts (kind OpenAI, SKU S0). **gpt-4o** (chat) is in `AZURE_AI_LOCATION`; **dall-e-3** (images) is in `AZURE_IMAGE_LOCATION` when `DEPLOY_IMAGE_MODEL` is true. The API Container App gets both endpoints and keys. **Region:** Use [supported regions](https://learn.microsoft.com/azure/ai-services/openai/concepts/models#model-summary-by-region) (e.g. West Europe for chat, Sweden Central for images).
- **Container App Environment** – Managed environment for the API (full deploy only).
- **Container App** – Runs the API image; gets OpenAI, SQL, and blob config from provision; updated by CD via `azd deploy` (full deploy only).
- **Function App** – Consumption plan (Flex), .NET 10 isolated; gets SQL connection string from provision; deployed by `azd deploy` (full deploy only).
- **Static Web App** – Frontend (Next.js static export) is built and deployed by the CD workflow with `NEXT_PUBLIC_API_URL` set to the API URL; no manual steps required.

## Prerequisites

- **Azure CLI** (`az`) – for login and resource group creation.
- **Azure Developer CLI** (`azd`) – for provision and deploy. [Install azd](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd).

## GitHub setup (CD)

1. **Secrets**
    - `AZURE_CREDENTIALS`: JSON for a service principal with Contributor on the subscription (or the target resource group). Create via: `az ad sp create-for-rbac --name "<name>" --role contributor --scopes /subscriptions/<sub-id> --sdk-auth`
    - `SQL_ADMIN_PASSWORD`: Password for the Azure SQL Server administrator (required for full deploy).
    - `FIREBASE_CREDENTIAL_JSON_BASE64`: Base64-encoded Firebase service account JSON (API).
    - `MAILGUN_API_KEY`: Mailgun API key (API and Function).

2. **Variables** (optional)
    - `RESOURCE_GROUP`: e.g. `rg-postgenerator-dev` (default used if unset).
    - `LOCATION`: e.g. `westeurope` (default used if unset).
    - `AZURE_AI_LOCATION`: Region for the GPT-4o (chat) OpenAI account (default: `westeurope`).
    - `AZURE_IMAGE_LOCATION`: Region for the DALL-E-3 (image) OpenAI account (default: `swedencentral`).
    - `AZURE_SQL_ADMIN_LOGIN`: SQL Server admin login (default: `sqladmin`).
    - API/Bicep: `FIREBASE_PROJECT_ID`, `CORS_ORIGINS` (comma-separated), `MAILGUN_DOMAIN`, `MAILGUN_FROM_ADDRESS`, `MAILGUN_FROM_NAME`.
    - Frontend build: `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and optionally `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`, `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

The workflow installs azd, configures an azd environment (including OpenAI locations and SQL credentials), runs `azd provision` (full stack, `LOCAL_DEV_ONLY=false`), sets the API URL for the frontend, runs `azd deploy` to build and deploy the API container and the Function app, then a **deploy_web** job builds the Next.js frontend with that API URL and deploys it to the provisioned Static Web App.

## Deploy locally

The local script provisions **only Azure OpenAI** (Cognitive Services with gpt-4o and dall-e-3) using azd with `LOCAL_DEV_ONLY=true`. It does not create the Container App, Function App, ACR, or other resources.

From the **repository root**, run:

```bash
./infra/deploy-local.sh
```

Use `--verbose` or `-v` for step-by-step logging. Optionally set `RESOURCE_GROUP`, `LOCATION`, or `AZD_ENV`:

```bash
RESOURCE_GROUP=rg-postgenerator-dev LOCATION=eastus ./infra/deploy-local.sh
```

The script checks for Azure CLI and azd, prompts for `az login` if needed, creates the resource group, creates/selects an azd environment (default name `local`), sets `LOCAL_DEV_ONLY=true`, runs `azd provision`, then prints the OpenAI endpoint. To get the Azure OpenAI API key for local config (e.g. `appsettings.Development.json` or user secrets), run:

```bash
OPENAI_NAME=$(az cognitiveservices account list --resource-group rg-postgenerator-dev --query "[?kind=='OpenAI'].name" -o tsv)
az cognitiveservices account keys list --name "$OPENAI_NAME" --resource-group rg-postgenerator-dev --query key1 -o tsv
```

## Parameters

Parameters are supplied via `infra/main.parameters.json`; values like `AZURE_ENV_NAME`, `AZURE_LOCATION`, and `LOCAL_DEV_ONLY` are set by azd (environment) or the deploy script/workflow.

| Parameter           | Default       | Description                                                                 |
| ------------------- | ------------- | --------------------------------------------------------------------------- |
| baseName            | postgen       | Prefix for resource names                                                   |
| environmentName     | (from env)    | Environment name (e.g. dev, local); from `AZURE_ENV_NAME`                   |
| location            | (from env)    | Azure region; from `AZURE_LOCATION`                                         |
| localDevOnly        | false         | When true, deploy only Azure OpenAI (for local dev); set by script/workflow |
| deployImageModel    | (from env)    | When true, deploy DALL-E-3; set false in regions that don't support it       |
| openAIChatLocation  | (from env)    | Region for gpt-4o; from `AZURE_AI_LOCATION`                                  |
| openAIImageLocation | (from env)    | Region for dall-e-3; from `AZURE_IMAGE_LOCATION`                            |
| sqlAdminLogin       | (from env)    | SQL Server admin login; from `AZURE_SQL_ADMIN_LOGIN`                         |
| sqlAdminPassword    | (from env)    | SQL Server admin password; from `AZURE_SQL_ADMIN_PASSWORD` (secret)         |
| apiImage            | (hello world) | Initial Container App image (CD replaces with built image)                  |
