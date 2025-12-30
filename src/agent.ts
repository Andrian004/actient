import {
  ActionRegistry,
  // ActionDefinition,
} from "./registry/action-registry.js";
import type { IntentParser } from "./intent/intent-parser.js";
import type { ZodSchema } from "zod";

export interface Intent {
  action: string;
  params: Record<string, any>;
}

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

    if (intent.action === "UNKNOWN") {
      throw new Error("Unable to determine user intent");
    }

    const action = this.registry.get(intent.action);
    const validatedParams = action.schema.parse(intent.params);

    return action.handler(validatedParams);
  }
}
