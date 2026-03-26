import type { AIMessage } from "../types/session";

export function formatContents(
  messages: AIMessage[],
  model: "gemini" | "openai" | "groq",
) {
  switch (model) {
    case "gemini":
      return messages.map((msg) => ({
        role: msg.role === "assistant" ? "model" : msg.role,
        parts: [{ text: msg.content }],
      }));

    case "openai":
      return messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    case "groq":
      return messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

    default:
      return [];
  }
}
