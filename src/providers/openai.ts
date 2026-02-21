import type { Intent } from "../types/intent";
import type { AvailableAction, IntentParser } from "../intent/intent-parser";
import { loadPackage } from "../utils/loader";
import { generateSystemPrompt } from "../utils/prompt";
import type * as OpenAIModule from "openai";

export class OpenAIIntentParser implements IntentParser {
  private client?: OpenAIModule.OpenAI;
  private readonly apiKey;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "gpt-4o-mini";
  }

  private async getClient(): Promise<OpenAIModule.OpenAI> {
    if (this.client) return this.client;

    const { default: OpenAI } = loadPackage<typeof OpenAIModule>("openai");
    this.client = new OpenAI({ apiKey: this.apiKey });

    return this.client;
  }

  async parse(prompt: string, actions: AvailableAction[]): Promise<Intent> {
    const systemPrompt = generateSystemPrompt(actions);
    const client = await this.getClient();

    const response = await client.chat.completions.create({
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

  private safeParseJSON(text: string): Intent {
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`Invalid JSON returned by AI: ${text}`);
    }
  }
}
