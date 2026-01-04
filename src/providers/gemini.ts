import type { Intent } from "../types/intent";
import type { AvailableAction, IntentParser } from "../intent/intent-parser";
import { generateSystemPrompt } from "../utils/prompt";
import { loadGemini } from "../utils/loader";
import type { GoogleGenAI } from "@google/genai"; // just for type import

export class GeminiIntentParser implements IntentParser {
  private client?: GoogleGenAI;
  private readonly apiKey: string;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "gemini-2.5-flash";
  }

  // lazy loader
  private async getClient(): Promise<GoogleGenAI> {
    if (this.client) return this.client;

    const { GoogleGenAI } = await loadGemini();
    this.client = new GoogleGenAI({ apiKey: this.apiKey });

    return this.client;
  }

  async parse(prompt: string, actions: AvailableAction[]): Promise<Intent> {
    const client = await this.getClient();
    const systemPrompt = generateSystemPrompt(actions);

    const result = await client.models.generateContent({
      model: this.model,
      contents: [
        {
          role: "user",
          parts: [{ text: systemPrompt + "\n\nUser input:\n" + prompt }],
        },
      ],
    });

    const content = result.text;

    if (!content) {
      throw new Error("Gemini returned empty response");
    }

    return this.safeParseJSON(content);
  }

  // json guard
  private safeParseJSON(text: string): Intent {
    try {
      const cleaned = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      return JSON.parse(cleaned);
    } catch {
      throw new Error(`Invalid JSON returned by Gemini:\n${text}`);
    }
  }
}
