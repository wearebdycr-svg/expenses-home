import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import cronHandler from './cron-reminder.js';

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

describe('api/cron-reminder.js unit tests', () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.CRON_SECRET = 'test-cron-secret';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
  });

  it('rejects unforced invocation outside 7:00 PM Colombia window with skipped=true', async () => {
    // Simulamos una hora fija fuera de la ventana (ej. 10:00 AM)
    const originalDateTimeFormat = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function (locale, options) {
      return {
        formatToParts: () => [
          { type: 'year', value: '2026' },
          { type: 'month', value: '11' },
          { type: 'day', value: '12' },
          { type: 'hour', value: '10' },
          { type: 'minute', value: '00' },
        ],
      };
    };

    try {
      const res = createMockRes();
      await cronHandler(
        {
          method: 'GET',
          headers: {
            authorization: 'Bearer test-cron-secret',
            origin: 'https://localhost',
          },
          query: {},
        },
        res
      );

      assert.equal(res.statusCode, 200);
      assert.equal(res.body?.skipped, true);
      assert.match(res.body?.reason, /7:00 PM/);
      assert.equal(res.body?.colombiaDate, '2026-11-12');
    } finally {
      Intl.DateTimeFormat = originalDateTimeFormat;
    }
  });

  it('evaluates fixed expenses when force=true, bypassing time window and deduplication', async () => {
    const fixedExpenses = [
      {
        id: 'fe-1',
        name: 'Internet Fibra',
        amount: 120000,
        dia_limite_mes: 15,
        dias_anticipacion_alerta: 5,
        status: 'activo',
        category: 'Servicios',
      },
    ];

    globalThis.fetch = async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/rest/v1/fcm_tokens')) {
        return new Response(JSON.stringify([{ token: 'fake-token-1' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/rest/v1/fixed_expenses')) {
        return new Response(JSON.stringify(fixedExpenses), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (urlStr.includes('/rest/v1/expenses')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const res = createMockRes();
    await cronHandler(
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-cron-secret',
          origin: 'https://localhost',
        },
        query: { force: 'true', type: 'fixed_expenses' },
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.success, true);
    assert.equal(res.body?.fixedExpenses?.evaluated, 1);
    assert.equal(res.body?.dailyReminder?.deliveredCount, 0);
  });

  it('skips fixed expenses if cron_executions has already recorded execution for today', async () => {
    const originalDateTimeFormat = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function () {
      return {
        formatToParts: () => [
          { type: 'year', value: '2026' },
          { type: 'month', value: '11' },
          { type: 'day', value: '12' },
          { type: 'hour', value: '19' },
          { type: 'minute', value: '00' },
        ],
      };
    };

    try {
      globalThis.fetch = async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/rest/v1/cron_executions') && urlStr.includes('job_name=eq.fixed_expenses')) {
          return new Response(
            JSON.stringify({
              last_run_date: 20261112,
              updated_at: '2026-11-12T19:00:00Z',
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Content-Range': '0-0/1',
              },
            }
          );
        }
        if (urlStr.includes('/rest/v1/fcm_tokens')) {
          return new Response(JSON.stringify([{ token: 'fake-token-1' }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const res = createMockRes();
      await cronHandler(
        {
          method: 'GET',
          headers: {
            authorization: 'Bearer test-cron-secret',
            origin: 'https://localhost',
          },
          query: { type: 'fixed_expenses' },
        },
        res
      );

      assert.equal(res.statusCode, 200);
      assert.equal(res.body?.fixedExpenses?.skipped, true);
      assert.match(res.body?.fixedExpenses?.reason, /ya fueron evaluadas y despachadas hoy/);
    } finally {
      Intl.DateTimeFormat = originalDateTimeFormat;
    }
  });

  it('skips daily reminder if cron_executions has already recorded execution for today', async () => {
    const originalDateTimeFormat = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function () {
      return {
        formatToParts: () => [
          { type: 'year', value: '2026' },
          { type: 'month', value: '11' },
          { type: 'day', value: '12' },
          { type: 'hour', value: '19' },
          { type: 'minute', value: '00' },
        ],
      };
    };

    try {
      globalThis.fetch = async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/rest/v1/cron_executions') && urlStr.includes('job_name=eq.daily_reminder_7pm')) {
          return new Response(
            JSON.stringify({
              last_run_date: 20261112,
              updated_at: '2026-11-12T19:00:00Z',
            }),
            {
              status: 200,
              headers: {
                'Content-Type': 'application/json',
                'Content-Range': '0-0/1',
              },
            }
          );
        }
        if (urlStr.includes('/rest/v1/fcm_tokens')) {
          return new Response(JSON.stringify([{ token: 'fake-token-1' }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const res = createMockRes();
      await cronHandler(
        {
          method: 'GET',
          headers: {
            authorization: 'Bearer test-cron-secret',
            origin: 'https://localhost',
          },
          query: { type: 'daily_reminder' },
        },
        res
      );

      assert.equal(res.statusCode, 200);
      assert.equal(res.body?.dailyReminder?.deliveredCount, 0);
      assert.match(res.body?.dailyReminder?.reason, /ya fue enviado hoy/);
    } finally {
      Intl.DateTimeFormat = originalDateTimeFormat;
    }
  });

  it('skips daily reminder if expenses were already registered for today in Colombia', async () => {
    const originalDateTimeFormat = Intl.DateTimeFormat;
    Intl.DateTimeFormat = function () {
      return {
        formatToParts: () => [
          { type: 'year', value: '2026' },
          { type: 'month', value: '11' },
          { type: 'day', value: '12' },
          { type: 'hour', value: '19' },
          { type: 'minute', value: '00' },
        ],
      };
    };

    try {
      globalThis.fetch = async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/rest/v1/cron_executions')) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (urlStr.includes('/rest/v1/expenses') && urlStr.includes('date=eq.2026-11-12')) {
          return new Response(JSON.stringify([{ id: 'exp-123' }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (urlStr.includes('/rest/v1/fcm_tokens')) {
          return new Response(JSON.stringify([{ token: 'fake-token-1' }]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      };

      const res = createMockRes();
      await cronHandler(
        {
          method: 'GET',
          headers: {
            authorization: 'Bearer test-cron-secret',
            origin: 'https://localhost',
          },
          query: { type: 'daily_reminder' },
        },
        res
      );

      assert.equal(res.statusCode, 200);
      assert.equal(res.body?.dailyReminder?.deliveredCount, 0);
      assert.match(res.body?.dailyReminder?.reason, /ya registró gastos hoy/);
    } finally {
      Intl.DateTimeFormat = originalDateTimeFormat;
    }
  });

  it('falls back gracefully without crashing when Supabase query fails', async () => {
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ message: 'Database connection failed', code: '500' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const res = createMockRes();
    await cronHandler(
      {
        method: 'POST',
        headers: {
          authorization: 'Bearer test-cron-secret',
          origin: 'https://localhost',
        },
        query: { force: 'true', type: 'all' },
      },
      res
    );

    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.success, true);
  });
});
