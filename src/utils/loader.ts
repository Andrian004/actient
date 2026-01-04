export async function loadGemini() {
  try {
    return await import("@google/genai");
  } catch {
    throw new Error(
      "Gemini support requires `@google/genai`. Install it with:\n" +
        "npm install @google/genai"
    );
  }
}

export async function loadOpenAI() {
  try {
    return await import("openai");
  } catch {
    throw new Error(
      "OpenAI support requires `openai`. Install it with:\n" +
        "npm install openai"
    );
  }
}

export async function loadGroq() {
  try {
    return await import("groq-sdk");
  } catch {
    throw new Error(
      "Groq support requires `groq-sdk`. Install it with:\n" +
        "npm install groq-sdk"
    );
  }
}
