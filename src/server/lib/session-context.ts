import { AsyncLocalStorage } from "node:async_hooks";

// See ARCHITECTURE.md § "Session correlation" for design rationale and lifecycle notes.
type SessionContext = { sessionId: string };

const storage = new AsyncLocalStorage<SessionContext>();

export const runWithSession = <T>(sessionId: string, fn: () => Promise<T>): Promise<T> =>
  storage.run({ sessionId }, fn);

export const getSessionId = (): string | undefined => storage.getStore()?.sessionId;
