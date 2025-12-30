import Groq from "groq-sdk";
import type { Intent } from "../agent.js";
import type { AvailableAction, IntentParser } from "../intent/intent-parser.js";

export class GroqIntentParser implements IntentParser {
  private client: Groq;
  private model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.client = new Groq({
      apiKey: options.apiKey,
    });

    this.model = options.model ?? "llama3-70b-8192";
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
      throw new Error("Groq returned empty response");
    }

    return this.safeParseJSON(content);
  }

  /**
   * System prompt khusus intent parsing
   */
  private buildSystemPrompt(actions: AvailableAction[]): string {
    return `
You are an intent parser.

Your task is to translate user input into a structured JSON intent.

Available actions:
${actions
  .map(
    (a) => `- ${a.name}: ${a.description}
  Parameters:
${Object.entries(a.parameters)
  .map(([key, type]) => `    - ${key}: ${type}`)
  .join("\n")}`
  )
  .join("\n")}

Rules:
- Respond ONLY with valid JSON
- Do NOT include markdown
- Do NOT explain anything
- Do NOT invent actions
- Only use actions listed above
- Parameter names MUST exactly match the schema
- Do NOT rename parameters
- Do NOT invent parameters
- JSON format:
{
  "action": "action_name",
  "params": { ... }
}

If no action matches, return:
{
  "action": "UNKNOWN",
  "params": {}
}
`.trim();
  }

  /**
   * Strict JSON parser (fail fast)
   */
  private safeParseJSON(text: string): Intent {
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Invalid JSON returned by Groq:\n${text}`);
    }
  }
}
