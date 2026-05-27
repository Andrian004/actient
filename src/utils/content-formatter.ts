import type { AIMessage } from "../types/session";

export function formatContents<T>(
  messages: AIMessage[],
  model: "gemini" | "openai" | "groq",
): T {
  switch (model) {
    case "gemini":
      return messages.map((msg) => ({
        role: msg.role === "assistant" ? "model" : msg.role,
        parts: [{ text: msg.content }],
      })) as T;

    case "openai":
    case "groq":
      return messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })) as T;

    default:
      return [] as T;
  }
}
