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
