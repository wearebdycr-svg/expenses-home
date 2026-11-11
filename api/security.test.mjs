import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import notifyHandler from './notify.js';
import cronHandler from './cron-reminder.js';
import fcmTokenHandler from './fcm-token.js';
import { applyCors, timingSafeEqualSecret } from './_security.js';

function createMockRes() {
  const headers = {};
  return {
    statusCode: 200,
    headers,
    body: undefined,
    ended: false,
    setHeader(name, value) {
      headers[name] = value;
    },
    getHeader(name) {
      return headers[name];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

describe('API serverless security hardening', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.CRON_SECRET;
    delete process.env.NOTIFY_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'public-anon-key-should-never-authorize';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  it('applyCors rejects disallowed origins and allows allowlisted origins without wildcard', () => {
    const evilRes = createMockRes();
    const blocked = applyCors({ headers: { origin: 'https://evil.example' } }, evilRes);
    assert.equal(blocked.allowed, false);
    assert.equal(evilRes.getHeader('Access-Control-Allow-Origin'), undefined);

    const okRes = createMockRes();
    const allowed = applyCors({ headers: { origin: 'https://localhost' } }, okRes);
    assert.equal(allowed.allowed, true);
    assert.equal(okRes.getHeader('Access-Control-Allow-Origin'), 'https://localhost');
    assert.equal(okRes.getHeader('Vary'), 'Origin');
  });

  it('timingSafeEqualSecret matches identical strings and rejects mismatches', () => {
    assert.equal(timingSafeEqualSecret('super-secret', 'super-secret'), true);
    assert.equal(timingSafeEqualSecret('super-secret', 'wrong-secret'), false);
    assert.equal(timingSafeEqualSecret('', 'super-secret'), false);
  });

  it('notify handler blocks disallowed origins with 403', async () => {
    const res = createMockRes();
    await notifyHandler(
      { method: 'POST', headers: { origin: 'https://attacker.invalid' }, body: {} },
      res
    );
    assert.equal(res.statusCode, 403);
    assert.equal(res.getHeader('Access-Control-Allow-Origin'), undefined);
  });

  it('notify handler rejects SUPABASE_ANON_KEY bearer token with 401', async () => {
    process.env.NOTIFY_SECRET = 'server-notify-secret';
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ message: 'Invalid JWT' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });

    const res = createMockRes();
    await notifyHandler(
      {
        method: 'POST',
        headers: {
          origin: 'https://finanzas-hogar-control-familiar.vercel.app',
          authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        body: { title: 'Test', body: 'Hello' },
      },
      res
    );

    assert.equal(res.statusCode, 401);
    assert.equal(
      res.getHeader('Access-Control-Allow-Origin'),
      'https://finanzas-hogar-control-familiar.vercel.app'
    );
  });

  it('notify handler fails closed (500) when auth backend is completely unconfigured', async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.NOTIFY_SECRET;
    delete process.env.CRON_SECRET;

    const res = createMockRes();
    await notifyHandler({ method: 'POST', headers: {}, body: { title: 'A', body: 'B' } }, res);
    assert.equal(res.statusCode, 500);
  });

  it('notify handler accepts valid NOTIFY_SECRET and valid Supabase user JWT', async () => {
    process.env.NOTIFY_SECRET = 'server-notify-secret';
    const resSecret = createMockRes();
    await notifyHandler(
      {
        method: 'POST',
        headers: { authorization: 'Bearer server-notify-secret' },
        body: {},
      },
      resSecret
    );
    assert.equal(resSecret.statusCode, 400);

    globalThis.fetch = async (url) => {
      const target = String(url);
      if (target.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'user-123', email: 'benny@example.com' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (target.includes('/rest/v1/fcm_tokens')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch URL: ${target}`);
    };

    const resJwt = createMockRes();
    await notifyHandler(
      {
        method: 'POST',
        headers: {
          origin: 'https://localhost',
          authorization: 'Bearer valid-supabase-user-jwt',
        },
        body: { title: 'Gasto', body: 'Prueba' },
      },
      resJwt
    );
    assert.equal(resJwt.statusCode, 200);
    assert.equal(resJwt.body.success, true);
  });

  it('cron-reminder handler fails closed when CRON_SECRET is unset and rejects SUPABASE_ANON_KEY', async () => {
    const resMissing = createMockRes();
    await cronHandler(
      { method: 'GET', headers: {}, query: {} },
      resMissing
    );
    assert.equal(resMissing.statusCode, 500);

    process.env.CRON_SECRET = 'cron-secret-123';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-secret';

    const resAnon = createMockRes();
    await cronHandler(
      {
        method: 'GET',
        headers: { authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}` },
        query: { force: 'true' },
      },
      resAnon
    );
    assert.equal(resAnon.statusCode, 401);

    const resEvilOrigin = createMockRes();
    await cronHandler(
      {
        method: 'GET',
        headers: {
          origin: 'https://evil.example',
          authorization: 'Bearer cron-secret-123',
        },
        query: { force: 'true' },
      },
      resEvilOrigin
    );
    assert.equal(resEvilOrigin.statusCode, 403);

    globalThis.fetch = async (url) => {
      if (String(url).includes('/rest/v1/fcm_tokens')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    };

    const resOk = createMockRes();
    await cronHandler(
      {
        method: 'GET',
        headers: { authorization: 'Bearer cron-secret-123' },
        query: { force: 'true' },
      },
      resOk
    );
    assert.equal(resOk.statusCode, 200);
    assert.equal(resOk.body.success, true);
  });

  it('fcm-token handler requires authentication on GET, POST, and DELETE and rejects invalid origins', async () => {
    const resOrigin = createMockRes();
    await fcmTokenHandler(
      { method: 'GET', headers: { origin: 'https://evil.example' } },
      resOrigin
    );
    assert.equal(resOrigin.statusCode, 403);

    globalThis.fetch = async (url) => {
      const target = String(url);
      if (target.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ message: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`Unexpected fetch URL: ${target}`);
    };

    for (const method of ['GET', 'POST', 'DELETE']) {
      const resUnauth = createMockRes();
      await fcmTokenHandler({ method, headers: {}, body: {} }, resUnauth);
      assert.equal(resUnauth.statusCode, 401, `Expected 401 for unauthenticated ${method}`);
    }

    globalThis.fetch = async (url) => {
      const target = String(url);
      if (target.includes('/auth/v1/user')) {
        return new Response(JSON.stringify({ id: 'user-123', email: 'charlie@example.com' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (target.includes('/rest/v1/fcm_tokens')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'content-range': '0-0/2',
          },
        });
      }
      throw new Error(`Unexpected fetch URL: ${target}`);
    };

    const resGet = createMockRes();
    await fcmTokenHandler(
      {
        method: 'GET',
        headers: {
          origin: 'http://localhost:4200',
          authorization: 'Bearer valid-jwt',
        },
      },
      resGet
    );
    assert.equal(resGet.statusCode, 200);
    assert.equal(resGet.body.registeredTokensCount, 2);

    const resPost = createMockRes();
    await fcmTokenHandler(
      {
        method: 'POST',
        headers: {
          origin: 'http://localhost:4200',
          authorization: 'Bearer valid-jwt',
        },
        body: { token: 'token-1234567890-abcdef', person: 'Charlie' },
      },
      resPost
    );
    assert.equal(resPost.statusCode, 200);
    assert.equal(resPost.body.success, true);

    const resDelete = createMockRes();
    await fcmTokenHandler(
      {
        method: 'DELETE',
        headers: {
          origin: 'http://localhost:4200',
          authorization: 'Bearer valid-jwt',
        },
        body: { token: 'token-1234567890-abcdef' },
      },
      resDelete
    );
    assert.equal(resDelete.statusCode, 200);
    assert.equal(resDelete.body.success, true);
  });
});
