import {
  ActionRegistry,
  // ActionDefinition,
} from "./registry/action-registry";
import type { IntentParser } from "./intent/intent-parser";
import type { ZodSchema } from "zod";
import type { Intent } from "./types/intent";
import MemorySessionStore from "./sessions/memory";
import type { AgentSession, SessionStore } from "./types/session";

export interface AIProvider {
  parseIntent(prompt: string, availableActions: any[]): Promise<Intent>;
}

type Session = {
  enabled: Boolean;
  driver: "memory";
  length: number;
};

export class AIAgent {
  private registry: ActionRegistry;
  private intentParser: IntentParser;
  private session: Session;
  private sessionStore: SessionStore<AgentSession> | null = null;

  constructor(options: { ai: IntentParser; session: Session }) {
    this.registry = new ActionRegistry();
    this.intentParser = options.ai;
    this.session = options.session;

    if (this.session.driver === "memory") {
      this.sessionStore = new MemorySessionStore<AgentSession>();
    }
  }

  registerAction<TParams, TResult>(
    name: string,
    config: {
      description: string;
      rules?: string[];
      schema: ZodSchema<TParams>;
      handler: (params: TParams) => Promise<TResult>;
    },
  ) {
    this.registry.register(name, config);
  }

  async execute(
    prompt: string,
    options?: {
      sessionId?: string;
    },
  ): Promise<any> {
    const availableActions = this.registry.list();
    if (!this.sessionStore) throw new Error("Session is not defined");

    const intent = await this.intentParser.parse(prompt, availableActions, {
      sessionId: options?.sessionId || "",
      sessionStore: this.sessionStore,
    });

    if (!intent?.action) {
      throw new Error("Invalid intent: missing action");
    }

    const action = this.registry.get(intent.action);

    if (intent.action === "UNKNOWN" && !action) {
      throw new Error(
        "Unable to determine user intent, please define a default action.",
      );
    }

    const validatedParams = action.schema.parse(intent.params);
    return action.handler(validatedParams);
  }
}
