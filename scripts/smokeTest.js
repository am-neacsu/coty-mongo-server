const http = require('http');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:4000';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(url, options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

async function run() {
  const checks = [
    { name: 'root endpoint', path: '/', expected: 200 },
    { name: 'health endpoint', path: '/api/health', expected: 200 },
    { name: 'judges endpoint', path: '/api/judges', expected: 200 }
  ];

  for (const check of checks) {
    const result = await request(check.path);
    const ok = result.statusCode === check.expected;
    console.log(`${ok ? 'PASS' : 'FAIL'} ${check.name}: HTTP ${result.statusCode}`);

    if (!ok) {
      process.exitCode = 1;
    }
  }

  const protectedResult = await request('/api/competitors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Smoke Test Competitor', category: 'Under 2 years' })
  });

  const protectedOk = protectedResult.statusCode === 401;
  console.log(`${protectedOk ? 'PASS' : 'FAIL'} protected admin route without token: HTTP ${protectedResult.statusCode}`);

  if (!protectedOk) {
    process.exitCode = 1;
  }
}

run().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});
