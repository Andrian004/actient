import type { Intent } from "../types/intent";
import type { AgentSession, AIMessage, SessionStore } from "../types/session";
import type { AvailableAction, IntentParser } from "../intent/intent-parser";
import { generateSystemPrompt } from "../utils/prompt";
import { loadPackage } from "../utils/loader";
import type * as GeminiModule from "@google/genai"; // just for type import
import { formatContents } from "../utils/content-formatter";

export class GeminiIntentParser implements IntentParser {
  private client?: GeminiModule.GoogleGenAI;
  private readonly apiKey: string;
  private readonly model: string;
  // private readonly opts: GeminiModule.GoogleGenAIOptions | undefined;

  constructor(options: {
    apiKey: string;
    model?: string;
    // opts?: GeminiModule.GoogleGenAIOptions;
  }) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? "gemini-2.5-flash";
    // this.opts = options.opts;
  }

  // lazy loader
  private async getClient(): Promise<GeminiModule.GoogleGenAI> {
    if (this.client) return this.client;

    const { GoogleGenAI } = loadPackage<typeof GeminiModule>("@google/genai");
    this.client = new GoogleGenAI({ apiKey: this.apiKey });

    return this.client;
  }

  async parse(
    prompt: string | string[],
    actions: AvailableAction[],
    options?: {
      sessionId: string;
      sessionStore: SessionStore<AgentSession>;
      maxLength?: number;
    },
  ): Promise<Intent> {
    const client = await this.getClient();
    const systemPrompt = generateSystemPrompt(actions);

    let history: AIMessage[] = [];

    if (options?.sessionId && options.sessionStore) {
      const session = await options.sessionStore.get(options.sessionId);
      if (session) history = session.messages;
    }

    const newMessage: AIMessage = {
      role: "user",
      content: Array.isArray(prompt) ? prompt.join("\n") : prompt,
    };

    const messages: AIMessage[] = [
      { role: "system", content: systemPrompt },
      ...history,
      newMessage,
    ];

    const contents = formatContents(messages, "gemini");

    const result = await client.models.generateContent({
      model: this.model,
      contents,
    });

    const responseText = result.text;

    if (!responseText) {
      throw new Error("Gemini returned empty response");
    }

    if (options?.sessionId && options.sessionStore) {
      let session = (await options.sessionStore.get(options.sessionId)) ?? {
        messages: [],
        state: {},
      };

      session.messages.push(newMessage);
      session.messages.push({
        role: "assistant",
        content: responseText,
      });

      if (options.maxLength && options.maxLength > 0) {
        session = {
          ...session,
          messages: session.messages.slice(-options.maxLength),
        };
      }

      await options.sessionStore.set(options.sessionId, session);
    }

    return this.safeParseJSON(responseText);
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
