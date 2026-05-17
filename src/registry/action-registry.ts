import type { ZodSchema } from "zod";
import { z } from "zod";

export type ActionHandler<TParams = any, TResult = any> = (
  params: TParams,
) => Promise<TResult>;

export interface ActionDefinition<TParams = any, TResult = any> {
  description: string;
  rules?: string[];
  schema: ZodSchema<TParams>;
  handler: ActionHandler<TParams, TResult>;
  outputSchema?: ZodSchema<TResult>; // ← tambahan, opsional
}

export class ActionRegistry {
  private actions = new Map<string, ActionDefinition>();

  register<TParams, TResult>(
    name: string,
    action: ActionDefinition<TParams, TResult>,
  ) {
    if (this.actions.has(name)) {
      throw new Error(`Action "${name}" already registered`);
    }

    this.actions.set(name, action);
  }

  get(name: string): ActionDefinition {
    const action = this.actions.get(name);

    if (!action) {
      throw new Error(`Action "${name}" is not registered`);
    }

    return action;
  }

  list(): Array<{
    name: string;
    rules: string[];
    description: string;
    parameters: Record<string, string>;
    output?: Record<string, string>; // ← tambahan
  }> {
    return Array.from(this.actions.entries()).map(([name, action]) => ({
      name,
      rules: action.rules || [],
      description: action.description,
      parameters: this.zodToSimpleSchema(action.schema),
      ...(action.outputSchema && {
        output: this.zodToSimpleSchema(action.outputSchema),
      }),
    }));
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  private zodToSimpleSchema(schema: ZodSchema<any>): Record<string, string> {
    // Kalau bukan ZodObject, wrap sebagai single "value" field
    // supaya LLM tetap dapat informasi tipe outputnya
    if (!(schema instanceof z.ZodObject)) {
      return { value: this.mapZodType(schema) };
    }

    const shape = schema.shape;
    const result: Record<string, string> = {};

    for (const key in shape) {
      result[key] = this.mapZodType(shape[key]);
    }

    return result;
  }

  private mapZodType(field: any): string {
    // unwrap optional / nullable
    if (field instanceof z.ZodOptional || field instanceof z.ZodNullable) {
      return this.mapZodType(field.unwrap());
    }

    if (field instanceof z.ZodString) return "string";
    if (field instanceof z.ZodNumber) return "number";
    if (field instanceof z.ZodBoolean) return "boolean";
    if (field instanceof z.ZodArray) return "array";
    if (field instanceof z.ZodEnum) return "enum";
    if (field instanceof z.ZodObject) return "object";

    return "unknown";
  }
}
