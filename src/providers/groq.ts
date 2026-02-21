import type { Intent } from "../types/intent";
import type { AvailableAction, IntentParser } from "../intent/intent-parser";
import { generateSystemPrompt } from "../utils/prompt";
import { loadPackage } from "../utils/loader";
import type * as GroqModule from "groq-sdk";

export class GroqIntentParser implements IntentParser {
  private client?: GroqModule.Groq;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "llama3-70b-8192";
  }

  private async getClient(): Promise<GroqModule.Groq> {
    if (this.client) return this.client;

    const { default: Groq } = loadPackage<typeof GroqModule>("groq-sdk");
    this.client = new Groq({ apiKey: this.apiKey });

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
      throw new Error("Groq returned empty response");
    }

    return this.safeParseJSON(content);
  }

  private safeParseJSON(text: string): Intent {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON returned by Groq:\n${text}`);
    }
  }
}
