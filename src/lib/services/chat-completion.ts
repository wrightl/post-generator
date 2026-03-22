import Anthropic from "@anthropic-ai/sdk";

function stripMarkdown(content: string): string {
  if (content.startsWith("```")) {
    return content.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  }
  return content;
}

export async function complete(
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
  const content =
    textBlock && "text" in textBlock ? textBlock.text?.trim() ?? null : null;
  return content ? stripMarkdown(content) : null;
}
