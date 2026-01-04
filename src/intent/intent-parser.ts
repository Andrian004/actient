import type { Intent } from "../types/intent";

export interface AvailableAction {
  name: string;
  rules?: string[];
  description: string;
  parameters: Record<string, string>;
}

export interface IntentParser {
  parse(prompt: string, actions: AvailableAction[]): Promise<Intent>;
}
