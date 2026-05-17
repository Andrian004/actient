import { ActionRegistry } from "./registry/action-registry";
import type { IntentParser } from "./intent/intent-parser";
import type { ZodSchema } from "zod";
import type { Intent, PlanResult, PlanStepResult } from "./types/intent";
import type { AgentSession, SessionStore } from "./types/session";

export interface AIProvider {
  parseIntent(prompt: string, availableActions: any[]): Promise<Intent>;
}

type Session = {
  enabled: Boolean;
  store?: SessionStore<AgentSession>;
  maxLength?: number;
};

export class AIAgent {
  private registry: ActionRegistry;
  private intentParser: IntentParser;
  private session: Session;
  private sessionStore: SessionStore<AgentSession> | null = null;
  // private mode: "single" | "plan";

  constructor(options: { ai: IntentParser; session: Session }) {
    this.registry = new ActionRegistry();
    this.intentParser = options.ai;
    this.session = options.session;
    // this.mode = options.mode || "single";

    if (this.session.enabled) {
      if (!this.session.store) {
        throw new Error(
          "Session store must be provided when session is enabled",
        );
      }

      this.sessionStore = this.session.store;
    }
  }

  registerAction<TParams, TResult>(
    name: string,
    config: {
      description: string;
      rules?: string[];
      schema: ZodSchema<TParams>;
      handler: (params: TParams) => Promise<TResult>;
      outputSchema?: ZodSchema<TResult>;
    },
  ) {
    this.registry.register(name, config);
  }

  // for executing single action
  async execute(
    prompt: string,
    options?: {
      sessionId?: string;
    },
  ): Promise<any> {
    const availableActions = this.registry.list();
    if (!this.sessionStore) throw new Error("Session is not defined");

    let intent;
    // if (this.mode === "plan") {
    // intent = await this.intentParser.parsePlan(prompt, availableActions, {
    //   sessionId: options?.sessionId || "",
    //   sessionStore: this.sessionStore,
    //   maxLength: this.session?.maxLength || 0,
    // });
    // } else {
    intent = await this.intentParser.parse(prompt, availableActions, {
      sessionId: options?.sessionId || "",
      sessionStore: this.sessionStore,
      maxLength: this.session?.maxLength || 0,
    });
    // }

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

  // for executing multi-step plan
  async executePlan(
    prompt: string,
    options?: {
      sessionId?: string;
      allowTransform?: boolean;
    },
  ): Promise<PlanResult> {
    const availableActions = this.registry.list();
    if (!this.sessionStore) throw new Error("Session is not defined");

    // 1. Generate plan dari LLM
    const plan = await this.intentParser.parsePlan(prompt, availableActions, {
      sessionId: options?.sessionId || "",
      sessionStore: this.sessionStore,
      maxLength: this.session?.maxLength || 0,
    });

    if (!plan?.steps?.length) {
      throw new Error("AI could not generate a valid plan for this prompt.");
    }

    // 2. Jalankan tiap step secara sequential
    const results: PlanStepResult[] = [];
    // Map untuk lookup result berdasarkan nama action
    const resultMap: Record<string, any> = {};

    for (const step of plan.steps) {
      if (step.action === "__transform__") {
        if (!options?.allowTransform) {
          throw new Error(
            `Plan requires a transform step but "allowTransform" is disabled. ` +
              `Enable it or redesign the actions so their types are compatible.`,
          );
        }

        if (!step.inputFrom) {
          throw new Error(`Transform step requires "inputFrom" to be set.`);
        }

        const previousResult = resultMap[step.inputFrom];
        const transformed = await this.intentParser.transform(
          previousResult,
          step.params.instructions,
        );

        resultMap["__transform__"] = transformed;
        results.push({
          action: "__transform__",
          result: transformed,
          status: "success",
        });
        continue; // skip schema.parse() dan handler
      }

      const action = this.registry.get(step.action);

      if (!action) {
        throw new Error(`Action "${step.action}" in plan is not registered.`);
      }

      // // 3. Build params
      let params = { ...step.params };

      if (step.inputFrom) {
        const previousResult = resultMap[step.inputFrom];

        if (previousResult === undefined) {
          throw new Error(
            `Action "${step.action}" expects output from "${step.inputFrom}", ` +
              `but that action has not run or failed.`,
          );
        }

        // Hanya works kalau previousResult adalah object
        if (typeof previousResult === "object" && previousResult !== null) {
          params = { ...params, ...previousResult };
        } else {
          // Primitif tanpa mapping → inject sebagai "previousResult"
          // LLM seharusnya define paramMapping untuk kasus ini
          params = { ...params, previousResult };
        }
      }

      // 4. Validasi params dengan schema yang sudah ada
      const validatedParams = action.schema.parse(params);

      // 5. Eksekusi — stop dan throw kalau gagal
      try {
        const result = await action.handler(validatedParams);
        resultMap[step.action] = result;
        results.push({ action: step.action, result, status: "success" });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        // Langsung throw — sesuai keputusan: stop eksekusi kalau ada yang gagal
        throw new Error(
          `Plan execution failed at action "${step.action}": ${error}`,
        );
      }
    }

    // 6. Return structured result
    return {
      success: true,
      plan: plan.steps.map((s) => s.action),
      results,
    };
  }
}
