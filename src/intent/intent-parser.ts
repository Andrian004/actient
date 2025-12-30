import type { Intent } from "../agent.js";

export interface AvailableAction {
  name: string;
  description: string;
  parameters: Record<string, string>;
}

export interface IntentParser {
  parse(prompt: string, actions: AvailableAction[]): Promise<Intent>;
}
