import { AsyncLocalStorage } from "async_hooks";
import type { SessionUser } from "@/lib/auth";

const store = new AsyncLocalStorage<SessionUser>();

/** Run work with an API-authenticated user visible to getSession()/requireUser(). */
export function runWithApiUser<T>(user: SessionUser, fn: () => T): T {
  return store.run(user, fn);
}

/** Active API Bearer user, if any (undefined outside runWithApiUser). */
export function getRequestUserOverride(): SessionUser | undefined {
  return store.getStore();
}

export function isApiRequestContext(): boolean {
  return store.getStore() !== undefined;
}
