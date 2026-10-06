import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

function isTestEnvironment(): boolean {
  const proc = (globalThis as any).process;
  return (
    typeof proc !== 'undefined' &&
    (Boolean(proc.env?.['VITEST']) || proc.env?.['NODE_ENV'] === 'test')
  );
}

function createMockClient(): any {
  const chainable = () => chainable;
  const dummyPromise = Promise.resolve({ data: [], error: null });

  const handler: ProxyHandler<any> = {
    get(target, prop) {
      if (prop === 'then') return dummyPromise.then.bind(dummyPromise);
      if (prop === 'catch') return dummyPromise.catch.bind(dummyPromise);
      if (prop === 'single') return () => Promise.resolve({ data: { id: 'mock-id' }, error: null });
      if (prop === 'channel') return () => ({ on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }) });
      if (prop === 'removeChannel') return () => Promise.resolve('ok');
      if (prop === 'auth') {
        return {
          getSession: () => Promise.resolve({ data: { session: { user: { id: 'test-user', email: 'test@familia.com' } } }, error: null }),
          onAuthStateChange: (cb: any) => {
            if (typeof cb === 'function') {
              cb('SIGNED_IN', { user: { id: 'test-user', email: 'test@familia.com' } });
            }
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
          signInWithPassword: () => Promise.resolve({ data: { session: { user: { id: 'test-user' } }, user: { id: 'test-user' } }, error: null }),
          signUp: () => Promise.resolve({ data: { session: { user: { id: 'test-user' } }, user: { id: 'test-user' } }, error: null }),
          signOut: () => Promise.resolve({ error: null }),
        };
      }
      return () => new Proxy(chainable, handler);
    },
    apply() {
      return new Proxy(chainable, handler);
    },
  };
  return new Proxy(chainable, handler);
}

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    if (isTestEnvironment()) {
      this.client = createMockClient();
    } else {
      this.client = createClient(environment.supabaseUrl, environment.supabaseAnonKey);
    }
  }
}
