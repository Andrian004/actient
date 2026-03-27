import type { Intent } from "../types/intent";
import type { SessionStore, AgentSession } from "../types/session";

export interface AvailableAction {
  name: string;
  rules?: string[];
  description: string;
  parameters: Record<string, string>;
}

export interface IntentParser {
  parse(
    prompt: string,
    actions: AvailableAction[],
    options?: { sessionId: string; sessionStore: SessionStore<AgentSession> },
  ): Promise<Intent>;
}
