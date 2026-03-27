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

export const generatePlanPrompt = (actions: AvailableAction[]): string => {
  return `
  You are an execution planner.

Your task is to convert user request into ordered execution steps.

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
- Return ONLY valid JSON
- Do NOT explain anything
- Do NOT include markdown
- Do NOT invent actions
- Only use listed actions
- Steps must be ordered logically
- If a step depends on previous result, use "$stepId.property"
- Only reference step IDs defined earlier
- Do NOT assume hidden context

Format:
{
  "steps": [
    {
      "id": "optional_string",
      "action": "action_name",
      "params": {}
    }
  ]
}
  `;
};
