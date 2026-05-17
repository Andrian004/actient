export interface Intent {
  action: string;
  params: Record<string, any>;
}

export interface PlanStep {
  action: string;
  params: Record<string, any>;
  /**
   * Nama action sebelumnya yang outputnya di-inject ke params step ini.
   * LLM yang menentukan ini saat generate plan.
   * null berarti step ini tidak butuh output dari step lain.
   */
  inputFrom: string | null;
  paramMapping?: Record<string, string>; // { targetKey: sourceKey }
}

export interface Plan {
  steps: PlanStep[];
  /**
   * Reasoning singkat dari LLM kenapa plan ini dipilih.
   * Berguna untuk debugging.
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
  plan: string[]; // nama actions yang dieksekusi, berurutan
  results: PlanStepResult[];
  summary?: string;
}
