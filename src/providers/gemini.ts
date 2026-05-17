import type { Intent, Plan } from "../types/intent";
import type { AgentSession, AIMessage, SessionStore } from "../types/session";
import type { AvailableAction, IntentParser } from "../intent/intent-parser";
import {
  generatePlanPrompt,
  generateSystemPrompt,
  generateTransformPrompt,
} from "../utils/prompt";
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

  // to execute single action
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

    const contents = formatContents<{
      role: string;
      parts: { text: string }[];
    }>(messages, "gemini");

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

    return this.safeParseJSON<Intent>(responseText);
  }

  // to execute multi-step plan
  async parsePlan(
    prompt: string | string[],
    actions: AvailableAction[],
    options?: {
      sessionId: string;
      sessionStore: SessionStore<AgentSession>;
      maxLength?: number;
      allowTransform?: boolean;
    },
  ): Promise<Plan> {
    const client = await this.getClient();
    const systemPrompt = generatePlanPrompt(
      actions,
      options?.allowTransform ?? false,
    );

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

    const contents = formatContents<{
      role: string;
      parts: { text: string }[];
    }>(messages, "gemini");

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

    return this.safeParseJSON<Plan>(responseText);
  }

  // for transforming data between actions (e.g. formatting API response to match next action's expected input)
  async transform(input: string, instructions: string): Promise<any> {
    const client = await this.getClient();
    const systemPrompt = generateTransformPrompt(input, instructions);

    const messages: AIMessage[] = [{ role: "user", content: systemPrompt }];
    const contents = formatContents<{
      role: string;
      parts: { text: string }[];
    }>(messages, "gemini");

    const result = await client.models.generateContent({
      model: this.model,
      contents,
    });

    const responseText = result.text;
    if (!responseText)
      throw new Error("Gemini returned empty response during transform");

    return this.safeParseJSON<any>(responseText);
  }

  // json guard
  private safeParseJSON<T>(text: string): T {
    try {
      const cleaned = text
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();

      return JSON.parse(cleaned) as T;
    } catch {
      throw new Error(`Invalid JSON returned by Gemini:\n${text}`);
    }
  }
}
