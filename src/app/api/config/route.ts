import { NextResponse } from "next/server";

export async function GET() {
  const provider = process.env.AI_PROVIDER ?? "AzureOpenAI";
  const imageGenerationAvailable =
    provider.toLowerCase() === "azureopenai" || provider.toLowerCase() === "azure";
  return NextResponse.json({
    aiProvider: provider,
    imageGenerationAvailable,
  });
}
