# Azure infrastructure

Infrastructure and deployment use **Azure Developer CLI (azd)**. The CD workflow runs `azd provision` and `azd deploy` on push to `main`. Local development uses the same Bicep with a `localDevOnly` parameter to provision only Azure OpenAI.

## Resources

- **Resource group** – Created by the workflow or deploy-local script (name/location from vars/env or defaults).
- **Log Analytics** – For Container Apps logs (full deploy only).
- **ACR** – Container registry for the API image (full deploy only).
- **Storage** – For the Function App (consumption) and general use (full deploy only).
- **Azure OpenAI** – Cognitive Services account (kind OpenAI, SKU S0) with two model deployments: **gpt-4o** (chat) and **dall-e-3** (images). The API Container App is configured automatically with the account endpoint and key via environment variables and a secret. **Region:** Azure OpenAI is only available in selected regions (e.g. East US, East US 2, Sweden Central); set `LOCATION` in a [supported region](https://learn.microsoft.com/azure/ai-services/openai/concepts/models#model-summary-by-region).
- **Container App Environment** – Managed environment for the API (full deploy only).
- **Container App** – Runs the API image; updated by CD via `azd deploy` (full deploy only).
- **Function App** – Consumption plan (Flex), .NET 10 isolated; deployed by `azd deploy` (full deploy only).

## Prerequisites

- **Azure CLI** (`az`) – for login and resource group creation.
- **Azure Developer CLI** (`azd`) – for provision and deploy. [Install azd](https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd).

## GitHub setup (CD)

1. **Secret**
    - `AZURE_CREDENTIALS`: JSON for a service principal with Contributor on the subscription (or the target resource group).
    - Create via: `az ad sp create-for-rbac --name "<name>" --role contributor --scopes /subscriptions/<sub-id> --sdk-auth`

2. **Variables** (optional)
    - `RESOURCE_GROUP`: e.g. `rg-postgenerator-dev` (default used if unset).
    - `LOCATION`: e.g. `westeurope` (default used if unset).

The workflow installs azd, configures an azd environment, runs `azd provision` (full stack, `LOCAL_DEV_ONLY=false`), then `azd deploy` to build and deploy the API container and the Function app.

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

| Parameter       | Default       | Description                                                                 |
| --------------- | ------------- | --------------------------------------------------------------------------- |
| baseName        | postgen       | Prefix for resource names                                                   |
| environmentName | (from env)    | Environment name (e.g. dev, local); from `AZURE_ENV_NAME`                   |
| location        | (from env)    | Azure region; from `AZURE_LOCATION`                                         |
| localDevOnly    | false         | When true, deploy only Azure OpenAI (for local dev); set by script/workflow |
| apiImage        | (hello world) | Initial Container App image (CD replaces with built image)                  |
