export interface IRefreshSessionStore {
  save(userId: string, sessionId: string, ttlSeconds: number): Promise<void>;
  isValid(userId: string, sessionId: string): Promise<boolean>;
  revoke(userId: string): Promise<void>;
}

export const REFRESH_SESSION_STORE = Symbol('REFRESH_SESSION_STORE');
