import type { Intent, Plan } from "../types/intent";
import type { SessionStore, AgentSession } from "../types/session";

export interface AvailableAction {
  name: string;
  rules?: string[];
  description: string;
  parameters: Record<string, string>;
  output?: Record<string, string>; // ← tambahan
}

export interface IntentParser {
  parse(
    prompt: string,
    actions: AvailableAction[],
    options?: {
      sessionId: string;
      sessionStore: SessionStore<AgentSession>;
      maxLength?: number;
    },
  ): Promise<Intent>;

  // method baru untuk plan agent
  parsePlan(
    prompt: string,
    actions: AvailableAction[],
    options?: {
      sessionId: string;
      sessionStore: SessionStore<AgentSession>;
      maxLength?: number;
    },
  ): Promise<Plan>;

  // method baru untuk transform agent
  transform(input: string, instructions: string): Promise<any>;
}
