export type AIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export type AgentSession = {
  messages: AIMessage[];
  state?: Record<string, any>;
};

export interface SessionStore<T = unknown> {
  get(sessionId: string): Promise<T | null>;
  set(sessionId: string, data: T): Promise<void>;
  clear(sessionId: string): Promise<void>;
}
