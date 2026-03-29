import type { SessionStore, AgentSession } from "../types/session";

export class RedisSessionStore implements SessionStore<AgentSession> {
  constructor(
    private client: any,
    private ttl?: number, // optional TTL
  ) {}

  async get(sessionId: string): Promise<AgentSession | null> {
    const data = await this.client.get(sessionId);
    return data ? JSON.parse(data) : null;
  }

  async set(sessionId: string, data: AgentSession): Promise<void> {
    const value = JSON.stringify(data);

    if (this.ttl) {
      await this.client.set(sessionId, value, "EX", this.ttl);
    } else {
      await this.client.set(sessionId, value);
    }
  }

  async clear(sessionId: string): Promise<void> {
    await this.client.del(sessionId);
  }
}
