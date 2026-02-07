#!/usr/bin/env bash
set -e

VERBOSE=
for arg in "$@"; do
  if [ "$arg" = "--verbose" ] || [ "$arg" = "-v" ]; then
    VERBOSE=1
    break
  fi
done

# Resolve repo root (parent of infra/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

RESOURCE_GROUP="${RESOURCE_GROUP:-rg-postgenerator-dev}"
LOCATION="${LOCATION:-westeurope}"
AZD_ENV="${AZD_ENV:-local}"

[ -n "$VERBOSE" ] && echo "[1/6] Checking Azure Developer CLI..."
if ! command -v azd &> /dev/null; then
  echo "Azure Developer CLI (azd) is not installed. Install it from https://learn.microsoft.com/azure/developer/azure-developer-cli/install-azd" >&2
  exit 1
fi
[ -n "$VERBOSE" ] && echo "  azd version: $(azd version 2>/dev/null || true)"

[ -n "$VERBOSE" ] && echo "[2/6] Checking Azure login..."
if ! az account show &> /dev/null; then
  echo "Not logged in to Azure. Running 'az login'..."
  az login
fi
if ! az account show &> /dev/null; then
  echo "Azure login failed or no subscription selected." >&2
  exit 1
fi
[ -n "$VERBOSE" ] && echo "  Subscription: $(az account show --query name -o tsv)"

[ -n "$VERBOSE" ] && echo "[3/6] Creating resource group: $RESOURCE_GROUP in $LOCATION"
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
[ -n "$VERBOSE" ] && echo "  Done."

[ -n "$VERBOSE" ] && echo "[4/6] Ensuring azd environment: $AZD_ENV"
if [ ! -d ".azure/$AZD_ENV" ]; then
  azd env new "$AZD_ENV" --subscription "$(az account show --query id -o tsv)" --location "$LOCATION"
fi
azd env select "$AZD_ENV"
azd env set AZURE_RESOURCE_GROUP "$RESOURCE_GROUP"
azd env set AZURE_LOCATION "$LOCATION"
azd env set LOCAL_DEV_ONLY "true"
# dall-e-3 Standard SKU is not available in West Europe; skip image deployment there
if [ "$LOCATION" = "westeurope" ]; then
  azd env set DEPLOY_IMAGE_MODEL "false"
else
  azd env set DEPLOY_IMAGE_MODEL "true"
fi

[ -n "$VERBOSE" ] && echo "[5/6] Provisioning Azure OpenAI (azd provision with local-dev only)..."
azd provision --no-prompt

[ -n "$VERBOSE" ] && echo "[6/6] Reading outputs..."
echo "Deployment succeeded. Outputs for local development:"
echo "---"
OPENAI_ENDPOINT=
if [ -f ".azure/$AZD_ENV/.env" ]; then
  OPENAI_ENDPOINT=$(grep -E '^openAIEndpoint=' ".azure/$AZD_ENV/.env" 2>/dev/null | cut -d= -f2- | tr -d '"' || true)
fi
if [ -z "$OPENAI_ENDPOINT" ]; then
  DEPLOYMENT_NAME=$(az deployment group list --resource-group "$RESOURCE_GROUP" --query "[0].name" -o tsv 2>/dev/null) || true
  if [ -n "$DEPLOYMENT_NAME" ]; then
    OPENAI_ENDPOINT=$(az deployment group show --resource-group "$RESOURCE_GROUP" --name "$DEPLOYMENT_NAME" --query "properties.outputs.openAIEndpoint.value" -o tsv 2>/dev/null) || true
  fi
fi
echo "openAIEndpoint:    ${OPENAI_ENDPOINT:-<see .azure/$AZD_ENV/.env>}"
echo "---"
echo "To get the Azure OpenAI API key for local config, run:"
echo "  OPENAI_NAME=\$(az cognitiveservices account list --resource-group \"$RESOURCE_GROUP\" --query \"[?kind=='OpenAI'].name\" -o tsv)"
echo "  az cognitiveservices account keys list --name \"\$OPENAI_NAME\" --resource-group \"$RESOURCE_GROUP\" --query key1 -o tsv"
echo ""
echo "Set AzureOpenAI:Endpoint and AzureOpenAI:ApiKey in appsettings.Development.json or user secrets."
