import type { Intent, Plan } from "../types/intent";
import type { AvailableAction, IntentParser } from "../intent/intent-parser";
import { loadPackage } from "../utils/loader";
import {
  generatePlanPrompt,
  generateSystemPrompt,
  generateTransformPrompt,
} from "../utils/prompt";
import type * as OpenAIModule from "openai"; // just for type import
import type { AgentSession, AIMessage, SessionStore } from "../types/session";
import { formatContents } from "../utils/content-formatter";

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

  // for executing single action
  async parse(
    prompt: string,
    actions: AvailableAction[],
    options?: {
      sessionId: string;
      sessionStore: SessionStore<AgentSession>;
      maxLength?: number;
    },
  ): Promise<Intent> {
    const systemPrompt = generateSystemPrompt(actions);
    const client = await this.getClient();

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

    const contents = formatContents<AIMessage[]>(messages, "openai");

    const response = await client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: contents,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("AI returned empty response");
    }

    return this.safeParseJSON<Intent>(content);
  }

  // for generating execution plan (multiple steps)
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

    const contents = formatContents<AIMessage[]>(messages, "openai");

    const result = await client.chat.completions.create({
      model: this.model,
      messages: contents,
    });

    const responseText = result.choices[0]?.message?.content;

    if (!responseText) {
      throw new Error("OpenAI returned empty response");
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
    const contents = formatContents<AIMessage[]>(messages, "openai");

    const response = await client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: contents,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned empty response");
    }

    return this.safeParseJSON<any>(content);
  }

  private safeParseJSON<T>(text: string): T {
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new Error(`Invalid JSON returned by OpenAI: ${text}`);
    }
  }
}
