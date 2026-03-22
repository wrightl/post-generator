import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

function stripMarkdown(content: string): string {
  if (content.startsWith("```")) {
    return content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  }
  return content;
}

export async function completeWithAzure(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string | null> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? "gpt-4o";

  if (!endpoint || !apiKey) {
    throw new Error("Azure OpenAI not configured");
  }

  const client = new OpenAI({
    apiKey,
    baseURL: `${endpoint.replace(/\/$/, "")}/openai/deployments/${deployment}`,
    defaultQuery: { "api-version": "2024-08-01-preview" },
  });

  const completion = await client.chat.completions.create({
    model: deployment,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
  });

  const content = completion.choices[0]?.message?.content;
  return content ? stripMarkdown(content.trim()) : null;
}

export async function completeWithClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

  if (!apiKey) {
    throw new Error("Anthropic not configured");
  }

  const anthropic = new Anthropic({ apiKey });

  const message = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  return textBlock && "text" in textBlock
    ? (textBlock.text?.trim() ?? null)
    : null;
}

export async function complete(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number
): Promise<string | null> {
  const provider = process.env.AI_PROVIDER ?? "azure";
  if (provider.toLowerCase() === "anthropic") {
    return completeWithClaude(systemPrompt, userPrompt, maxTokens);
  }
  return completeWithAzure(systemPrompt, userPrompt, maxTokens);
}
