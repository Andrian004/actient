export interface Intent {
  action: string;
  params: Record<string, any>;
}

export interface PlanStep {
  action: string;
  params: Record<string, any>;
  /**
   * Name of the previous action whose output is injected into this step's params.
   * LLM determines this when generating the plan.
   * null means this step does not require output from another step.
   */
  inputFrom: string | null;
  paramMapping?: Record<string, string>; // { targetKey: sourceKey }
}

export interface Plan {
  steps: PlanStep[];
  /**
   * Reasoning from the LLM on why this plan was chosen.
   * Useful for debugging and understanding the LLM's decision-making process.
   */
  reasoning: string;
}

export interface PlanStepResult {
  action: string;
  result: any;
  status: "success" | "failed";
  error?: string;
}

export interface PlanResult {
  success: boolean;
  plan: string[]; // List of action names in execution order
  results: PlanStepResult[];
  summary?: string;
}
