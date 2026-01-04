import {
  ActionRegistry,
  // ActionDefinition,
} from "./registry/action-registry";
import type { IntentParser } from "./intent/intent-parser";
import type { ZodSchema } from "zod";
import type { Intent } from "./types/intent";

export interface AIProvider {
  parseIntent(prompt: string, availableActions: any[]): Promise<Intent>;
}

export class AIAgent {
  private registry: ActionRegistry;
  private intentParser: IntentParser;

  constructor(options: { ai: IntentParser }) {
    this.registry = new ActionRegistry();
    this.intentParser = options.ai;
  }

  registerAction<TParams, TResult>(
    name: string,
    config: {
      description: string;
      rules?: string[];
      schema: ZodSchema<TParams>;
      handler: (params: TParams) => Promise<TResult>;
    }
  ) {
    this.registry.register(name, config);
  }

  async execute(prompt: string): Promise<any> {
    const availableActions = this.registry.list();
    const intent = await this.intentParser.parse(prompt, availableActions);

    if (!intent?.action) {
      throw new Error("Invalid intent: missing action");
    }

    const action = this.registry.get(intent.action);

    if (intent.action === "UNKNOWN" && !action) {
      throw new Error(
        "Unable to determine user intent, please define a default action."
      );
    }

    const validatedParams = action.schema.parse(intent.params);
    return action.handler(validatedParams);
  }
}
