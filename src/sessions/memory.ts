import type { SessionStore } from "../types/session";

export default class MemorySessionStore<T> implements SessionStore<T> {
  private store = new Map<string, T>();

  async get(sessionId: string): Promise<T | null> {
    return this.store.get(sessionId) ?? null;
  }

  async set(sessionId: string, data: T): Promise<void> {
    this.store.set(sessionId, data);
  }

  async clear(sessionId: string): Promise<void> {
    this.store.delete(sessionId);
  }
}
