import type { AvailableAction } from "../intent/intent-parser";

export const generateSystemPrompt = (actions: AvailableAction[]): string => {
  return `
You are an intent parser.

Your task is to translate user input into a structured JSON intent.

Available actions:
${actions
  .map(
    (a) => `- ${a.name}: ${a.description}
  Parameters:
${Object.entries(a.parameters)
  .map(([key, type]) => `    - ${key}: ${type}`)
  .join("\n")}
  Specific rules: ${
    a.rules?.length ? a.rules.map((r) => `    - ${r}`).join("\n") : "    - None"
  }
  `,
  )
  .join("\n")}

  
Rules:
- Respond ONLY with valid JSON
- Do NOT include markdown
- Do NOT explain anything
- Do NOT invent actions
- Only use actions listed above
- Parameter names MUST exactly match the schema
- Do NOT rename parameters
- Do NOT invent parameters
- JSON format:
{
  "action": "action_name",
  "params": { ... }
}

If no action matches, return:
{
  "action": "UNKNOWN",
  "params": {}
}
`.trim();
};

export const generatePlanPrompt = (
  actions: AvailableAction[],
  allowTransform: boolean = false,
): string => {
  return `
You are an execution planner.

Your task is to convert a user request into ordered execution steps using only the available actions listed below.

Available actions:
${actions
  .map(
    (a) => `
- ${a.name}: ${a.description}
  Parameters (input):
${
  Object.entries(a.parameters).length
    ? Object.entries(a.parameters)
        .map(([key, type]) => `    - ${key}: ${type}`)
        .join("\n")
    : "    - None"
}
  Output:
${
  a.output && Object.entries(a.output).length
    ? Object.entries(a.output)
        .map(([key, type]) => `    - ${key}: ${type}`)
        .join("\n")
    : "    - Unknown"
}
  Rules: ${
    a.rules?.length
      ? "\n" + a.rules.map((r) => `    - ${r}`).join("\n")
      : "None"
  }`,
  )
  .join("\n")}

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- Only use actions from the list above, do NOT invent actions
- Steps must be ordered logically
- Set "inputFrom" to the action name whose result is needed, or null if this step is standalone
- If output of the previous action needs to be mapped to specific params, use "paramMapping": { "targetParam": "sourceField" }
- "sourceField" supports dot notation for nested fields (e.g. "user.id", "data.records")
- Only reference action names that appear earlier in the steps array
- Do NOT assume hidden context or data not provided by the user
${
  allowTransform
    ? `
Transform rules (ONLY use when types are fundamentally incompatible):
- If the output type of a step is fundamentally incompatible with the expected input of the next step (e.g. output is a number but input expects an object), insert a "__transform__" step between them
- "__transform__" is a built-in special action, NOT from the available actions list
- Set "inputFrom" to the action whose output needs to be transformed
- Set "params.instructions" to a clear, specific instruction of how to reshape the data
- The result of "__transform__" can then be referenced by the next step via "inputFrom": "__transform__"
- Use "__transform__" as a LAST RESORT — prefer paramMapping first if field names just differ but types are compatible
`
    : `
- If types are fundamentally incompatible (e.g. output is a number but input expects an object), do NOT chain them — set "inputFrom" to null and use only static params, or reconsider the plan
`
}

Output format:
{
  "reasoning": "brief explanation of why these steps and this order",
  "steps": [
    {
      "action": "actionName",
      "params": { "staticKey": "staticValue" },
      "inputFrom": "previousActionName" | null,
      "paramMapping": { "targetParam": "sourceField" } | null
    }
  ]
}

${
  allowTransform
    ? `Example with __transform__:
{
  "reasoning": "getCount returns a number, but generateReport expects an object, so transform is needed",
  "steps": [
    { "action": "getCount", "params": {}, "inputFrom": null, "paramMapping": null },
    { "action": "__transform__", "params": { "instructions": "wrap the number into an object: { total: <value> }" }, "inputFrom": "getCount", "paramMapping": null },
    { "action": "generateReport", "params": { "title": "Stock Report" }, "inputFrom": "__transform__", "paramMapping": { "total": "total" } }
  ]
}`
    : ""
}
  `.trim();
};

export const generateTransformPrompt = (
  input: string,
  instructions: string,
): string => {
  return `Transform the following data according to the instructions.
Return ONLY valid JSON, no explanation, no markdown.

Data:
${JSON.stringify(input, null, 2)}

Instructions:
${instructions}`;
};
