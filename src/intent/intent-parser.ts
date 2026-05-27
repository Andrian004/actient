import type { Intent, Plan } from "../types/intent";
import type { SessionStore, AgentSession } from "../types/session";

export interface AvailableAction {
  name: string;
  rules?: string[];
  description: string;
  parameters: Record<string, string>;
  output?: Record<string, string>; // ← additional
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

  // new method for plan agent
  parsePlan(
    prompt: string,
    actions: AvailableAction[],
    options?: {
      sessionId: string;
      sessionStore: SessionStore<AgentSession>;
      maxLength?: number;
      allowTransform?: boolean; // option to allow LLM to use transform agent
    },
  ): Promise<Plan>;

  // new method for transform agent
  transform(input: string, instructions: string): Promise<any>;
}
