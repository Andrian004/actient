# Actient

Connect and run your functions with your favorite AI easier.

### In this page

- [Get Started](#get-started)
- [How it's work](#how-its-work)
- [References](#references)
  - [Supported SDK](#our-supported-sdk)
  - [AI Agent](#ai-agent)
  - [registerAction()](#registeraction)
  - [execute()](#execute)
  - [executePlan()](#executeplan)
- [Sessions](#session)
  - [Memory Store](#memory-store)
  - [Redis](#redis-store)
  - [Custom Store](#custom-store)
- [Best Practices](#best-practices)
  - [Unknown action](#unknown-action)
  - [Specific rules](#specific-rules)
- [Typescript Support](#typescript-support)

## Get started

Install package:

```bash
npm install actient zod openai
```

## How it's work?

```js
import { AIAgent } from "actient";
import { OpenAIIntentParser } from "actient/providers/openai";
import { z } from "zod";

// define ai agent
const agent = new AIAgent({
  ai: new OpenAIIntentParser({
    apiKey: "your_api_key",
    model: "ai-model",
  }),
});

// register your function as action
agent.registerAction("increase_stock", {
  description: "Add product stock",
  schema: z.object({
    name: z.string(),
    amount: z.number().positive(),
  }),
  handler: async ({ name, amount }) => {
    // you can create simple or complex logic here
    return prisma.product.updateMany({
      where: { name: { contains: name, mode: "insensitive" } },
      data: { stock: { increment: amount } },
    });
  },
});

// it will execute action to update your product stock
agent.execute("Can you add 5 units of stock to my product named monitor?");
```

## References

This section documents the main function provided by `actient`, including the core agent, intent parser, and available AI providers.

### Our supported SDK:

You need to install the SDK before using this library. Use the intent parser importing from `actient/providers/*` to setup your AI.

| Provider | SDK             | Intent Parser                                                  |
| -------- | --------------- | -------------------------------------------------------------- |
| Open AI  | `openai`        | `OpenAIIntentParser`, imported from `actient/providers/openai` |
| Groq     | `groq-sdk`      | `GroqIntentParser`, imported from `actient/providers/groq`     |
| Gemini   | `@google/genai` | `GeminiIntentParser`, imported from `actient/providers/gemini` |

### AI Agent

You can define and select your ai agent using `AIAgent` instance.

```js
const agent = new AIAgent({
  ai: new OpenAIIntentParser({
    apiKey: "your_api_key", // api key from ai provider
    model: "ai-model",
  }),
});
```

#### Options

| Name | Desciption                                                                               |
| ---- | ---------------------------------------------------------------------------------------- |
| ai   | Define your selected ai intent parser. See our supported intent parser to get the detail |

### registerAction()

Registers actions that can be executed by the agent.

```js
agent.registerAction("action_identifier", {
  description: "Action description",
  rules: ["specific rule"],
  schema: z.object({
    params: z.string(),
  }),
  outputSchema: z.string(),
  handler: async ({ params }) => {
    // you can create simple or complex logic here
    return `Success to execute: ${params}`;
  },
});
```

#### Options

| Name         | Type            | Required | Desciption                                                           |
| ------------ | --------------- | -------- | -------------------------------------------------------------------- |
| \_identifier | string          | ✅       | Unique action identifier (used by AI to recognize the functions)     |
| description  | string          | ✅       | Brief explanation of the action function (used in the system prompt) |
| rules        | array of string | ❌       | Specific rules for the action                                        |
| schema       | ZodSchema       | ✅       | Zod schema for action parameter validation                           |
| outputSchema | ZodSchema       | ❌       | Zod schema for action output                                         |
| handler      | function        | ✅       | Async function that will be executed by AI                           |

### execute()

Runs agent based on user input.

```js
const result = await agent.execute("User prompt");
```

> `execute` can only run one action, if you want to run multiple actions, use `executePlan()`

### executePlan()

`executePlan()` allows the AI to execute **multiple actions in sequence** by creating an execution plan automatically.

Simply register your actions, and the agent will decide which functions to call and in what order.

**Basic Usage:**

```js
const result = await agent.executePlan(message, {
  sessionId,
});
```

**Enable Result Transformation:**

Set `allowTransform` to `true` if you want the AI to **transform the result of a previous action before passing it to the next one**.

```js
const result = await agent.executePlan(message, {
  sessionId,
  allowTransform: true,
});
```

> **Warning**  
> When `allowTransform` is enabled, the AI can read the results of executed actions. Avoid returning sensitive or private data unless necessary.

## Session

You can make your AI to memorize the context of conversation to better experience.

```js
import { MemorySessionStore } from "actient";

const agent = new AIAgent({
  ai: new GeminiIntentParser(),
  session: {
    enabled: true, // default false
    store: new MemorySessionStore(),
    maxLength: 10, // length cache of messages
  },
});

// Important: Session IDs are created and managed by you. You can create multiple or single sessions for each user.
const result = await agent.execute("User prompt", { sessionId: "session_id" });
```

### Memory Store

This is a simple way to store your conversations but it's not recomended for complex case.

```js
import { MemorySessionStore } from "actient";

const agent = new AIAgent({
  ai: new GeminiIntentParser(),
  session: {
    enabled: true, // default false
    store: new MemorySessionStore(),
    maxLength: 10, // length cache of messages
  },
});
```

### Redis Store

This is the better way to implement session store.

```js
import { RedisSessionStore } from "actient";

const redis = new Redis(); // from ioredis

const agent = new AIAgent({
  ai: new GeminiIntentParser(),
  session: {
    enabled: true, // default false
    store: new RedisSessionStore(redis, 3600),
    maxLength: 10, // length cache of messages
  },
});
```

### Custom Store

You can create session store by your own. You can integrate with your favorite database.

For example using `prisma`:

```prisma
model AgentSession {
  id         String   @id @default(cuid())
  sessionId  String   @unique
  data       Json
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([sessionId])
}
```

And your session store will look like this:

```ts
import type { SessionStore, AgentSession } from "actient";
import { AIAgent } from "actient";
import { prisma } from "@/lib/prisma";

class MyCustomStore implements SessionStore<AgentSession> {
  async get(sessionId: string) {
    // get session data from postgre using prisma
    const session = await prisma.agentSession.findUnique({
      where: { sessionId },
    });

    if (!session) return null;

    return session.data as AgentSession;
  }

  async set(sessionId: string, data: AgentSession) {
    // post session data to database
    await prisma.agentSession.upsert({
      where: { sessionId },
      update: { data },
      create: { sessionId, data },
    });
  }

  async clear(sessionId: string) {
    // clear session from db
    await prisma.agentSession.deleteMany({
      where: { sessionId },
    });
  }
}

const agent = new AIAgent({
  ai: new GeminiIntentParser(),
  session: {
    enabled: true, // default false
    store: new MyCustomStore(),
    maxLength: 10, // length cache of messages
  },
});
```

## Best Practices

This section outlines recommended best practices to help you build reliable, maintainable, and predictable AI-driven actions using this library.

### Unknown Action

The AI ​​will only execute the appropriate action. If no appropriate action is found, it will treat it as `UNKNOWN`. You can handle this by defining a register with the identifier as `UNKNOWN`.

```js
agent.registerAction("UNKNOWN", {
  description: "Default handler for unknown intents",
  rules: ["Handle unknown intents gracefully and inform the user."],
  schema: z.object({
    message: z.string(),
  }),
  handler: async ({ message }) => {
    return { message };
  },
});
```

### Specific rules

Add specific rules to ensure the AI ​​works properly and prevent the AI ​​from deviating from its task.

```js
agent.registerAction("action", {
  rules: ["rule 1", "rule 2"],
  // ...
});
```

## Typescript Support

This library is completely written and maintained using typescript.
