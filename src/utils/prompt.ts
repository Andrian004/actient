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
  `
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
