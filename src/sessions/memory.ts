import type { SessionStore, AgentSession } from "../types/session";

export class MemorySessionStore implements SessionStore<AgentSession> {
  private store = new Map<string, AgentSession>();

  async get(sessionId: string): Promise<AgentSession | null> {
    return this.store.get(sessionId) ?? null;
  }

  async set(sessionId: string, data: AgentSession): Promise<void> {
    this.store.set(sessionId, data);
  }

  async clear(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }
}
