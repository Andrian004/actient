import OpenAI from "openai";
import type { Intent } from "../agent.js";
import type { AvailableAction, IntentParser } from "../intent/intent-parser.js";

export class OpenAIIntentParser implements IntentParser {
  private client: OpenAI;
  private model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model ?? "gpt-4o-mini";
  }

  async parse(prompt: string, actions: AvailableAction[]): Promise<Intent> {
    const systemPrompt = this.buildSystemPrompt(actions);

    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("AI returned empty response");
    }

    return this.safeParseJSON(content);
  }

  /**
   * SYSTEM PROMPT = FONDASI STABILITAS
   */
  private buildSystemPrompt(actions: AvailableAction[]): string {
    return `
You are an intent parser.

Your task is to translate user input into a structured JSON intent.

Available actions:
${actions.map((a) => `- ${a.name}: ${a.description}`).join("\n")}

Rules:
- Respond ONLY with valid JSON
- Do NOT add explanation
- Do NOT invent actions
- Use only available actions
- JSON format:
{
  "action": "action_name",
  "params": { ... }
}

If no action is relevant, return:
{
  "action": "UNKNOWN",
  "params": {}
}
`.trim();
  }

  /**
   * JSON parsing dengan guard
   */
  private safeParseJSON(text: string): Intent {
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Invalid JSON returned by AI: ${text}`);
    }
  }
}
