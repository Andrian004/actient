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

  constructor(options: { ai: IntentParser; session: Session }) {
    this.registry = new ActionRegistry();
    this.intentParser = options.ai;
    this.session = options.session;

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
    intent = await this.intentParser.parse(prompt, availableActions, {
      sessionId: options?.sessionId || "",
      sessionStore: this.sessionStore,
      maxLength: this.session?.maxLength || 0,
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

    // 1. Generate plan from LLM
    const plan = await this.intentParser.parsePlan(prompt, availableActions, {
      sessionId: options?.sessionId || "",
      sessionStore: this.sessionStore,
      maxLength: this.session?.maxLength || 0,
      allowTransform: options?.allowTransform ?? false,
    });

    if (!plan?.steps?.length) {
      throw new Error("AI could not generate a valid plan for this prompt.");
    }

    // 2. Run through each step in the plan
    const results: PlanStepResult[] = [];
    // Map to lookup result based on action name
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

        if (step.paramMapping && Object.keys(step.paramMapping).length > 0) {
          // Get specific fields according to mapping — support dot notation
          for (const [targetKey, sourceKey] of Object.entries(
            step.paramMapping,
          )) {
            params[targetKey] = sourceKey
              .split(".")
              .reduce((obj: any, key: string) => obj?.[key], previousResult);
          }
        } else {
          // No mapping — spread all previousResult as fallback
          // Only works if previousResult is an object
          if (typeof previousResult === "object" && previousResult !== null) {
            params = { ...params, ...previousResult };
          } else {
            // Primitive without mapping → inject as "previousResult"
            // LLM should define paramMapping for this case
            params = { ...params, previousResult };
          }
        }
      }

      // 4. Validate params with existing schema
      const validatedParams = action.schema.parse(params);

      // 5. Execute — stop and throw if failed
      try {
        const result = await action.handler(validatedParams);
        resultMap[step.action] = result;
        results.push({ action: step.action, result, status: "success" });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
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
      summary: plan?.reasoning || "No reasoning provided.",
    };
  }
}
