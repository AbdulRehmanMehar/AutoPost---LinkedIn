#!/usr/bin/env node

/**
 * Test script to verify all new API endpoints
 * Run: node scripts/test-endpoints.mjs [base_url]
 * 
 * Default base_url: http://localhost:3000
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
};

const log = {
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  fail: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  dim: (msg) => console.log(`${colors.dim}  ${msg}${colors.reset}`),
};

async function testEndpoint(method, path, options = {}) {
  const url = `${BASE_URL}${path}`;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const status = response.status;
    const isSuccess = status >= 200 && status < 500; // 4xx might be expected (auth required)

    return {
      success: isSuccess,
      status,
      url,
      method,
      body: await response.text().catch(() => null),
    };
  } catch (error) {
    return {
      success: false,
      status: 0,
      url,
      method,
      error: error.message,
    };
  }
}

async function runTests() {
  console.log('\n📋 Testing API Endpoints\n');
  console.log(`Base URL: ${BASE_URL}\n`);
  console.log('─'.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    warnings: 0,
  };

  // Test groups
  const testGroups = [
    {
      name: '🏥 Health & Auth',
      tests: [
        { method: 'GET', path: '/api/health', expectStatus: [200] },
        { method: 'GET', path: '/api/auth/session', expectStatus: [200] },
      ],
    },
    {
      name: '📝 Posts API',
      tests: [
        { method: 'GET', path: '/api/posts', expectStatus: [200, 401] },
        { method: 'GET', path: '/api/posts/pending', expectStatus: [200, 401] },
        { method: 'GET', path: '/api/posts/performance', expectStatus: [200, 401] },
      ],
    },
    {
      name: '📊 Blog Repurpose API',
      tests: [
        { method: 'POST', path: '/api/blog/analyze', expectStatus: [400, 401], body: {} },
        { method: 'POST', path: '/api/blog/generate', expectStatus: [400, 401], body: {} },
      ],
    },
    {
      name: '💬 Comments API',
      tests: [
        { method: 'GET', path: '/api/comments/suggestions', expectStatus: [200, 401] },
        { method: 'POST', path: '/api/comments/suggestions', expectStatus: [400, 401], body: {} },
      ],
    },
    {
      name: '🤝 Engagements API',
      tests: [
        { method: 'GET', path: '/api/engagements', expectStatus: [200, 401] },
        { method: 'GET', path: '/api/engagements/settings', expectStatus: [200, 401] },
        { method: 'GET', path: '/api/engagements/replies', expectStatus: [200, 401] },
      ],
    },
    {
      name: '⏰ Cron Endpoints',
      tests: [
        { method: 'GET', path: '/api/cron/publish', expectStatus: [200, 401] },
        { method: 'GET', path: '/api/cron/engage', expectStatus: [200, 401] },
      ],
    },
  ];

  for (const group of testGroups) {
    console.log(`\n${group.name}`);
    console.log('─'.repeat(40));

    for (const test of group.tests) {
      const result = await testEndpoint(test.method, test.path, { body: test.body });

      if (result.error) {
        log.fail(`${test.method} ${test.path}`);
        log.dim(`Error: ${result.error}`);
        results.failed++;
      } else if (test.expectStatus.includes(result.status)) {
        log.success(`${test.method} ${test.path} → ${result.status}`);
        results.passed++;
      } else if (result.status === 401) {
        log.warn(`${test.method} ${test.path} → ${result.status} (auth required)`);
        results.warnings++;
      } else {
        log.fail(`${test.method} ${test.path} → ${result.status}`);
        log.dim(`Expected: ${test.expectStatus.join(' or ')}`);
        results.failed++;
      }
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('\n📊 Summary\n');
  log.success(`Passed: ${results.passed}`);
  log.warn(`Warnings: ${results.warnings}`);
  log.fail(`Failed: ${results.failed}`);

  // Environment check
  console.log('\n🔧 Environment Variables Check\n');

  const envVars = [
    { name: 'GROQ_API_KEY', required: true },
    { name: 'RESEND_API_KEY', required: false, note: 'For email approvals' },
    { name: 'MONGODB_URI', required: true },
    { name: 'NEXTAUTH_SECRET', required: true },
    { name: 'NEXTAUTH_URL', required: true, note: 'For approval email links' },
    { name: 'LINKEDIN_CLIENT_ID', required: true },
    { name: 'LINKEDIN_CLIENT_SECRET', required: true },
    { name: 'AWS_ACCESS_KEY_ID', required: false, note: 'For media uploads' },
  ];

  console.log('Note: This checks if vars are set, not if they\'re valid.\n');

  for (const env of envVars) {
    const isSet = process.env[env.name] !== undefined;
    const status = isSet ? '✓ Set' : env.required ? '✗ Missing' : '○ Optional';
    const color = isSet ? colors.green : env.required ? colors.red : colors.dim;
    console.log(`${color}${status}${colors.reset} ${env.name}${env.note ? colors.dim + ` (${env.note})` + colors.reset : ''}`);
  }

  // Pages check
  console.log('\n📄 Dashboard Pages\n');

  const pages = [
    '/dashboard',
    '/dashboard/create',
    '/dashboard/scheduled',
    '/dashboard/engagements',
    '/dashboard/approvals',
    '/dashboard/blog',
    '/dashboard/comments',
  ];

  for (const page of pages) {
    const result = await testEndpoint('GET', page);
    if (result.status === 200 || result.status === 307 || result.status === 302) {
      log.success(`${page} → accessible`);
    } else {
      log.fail(`${page} → ${result.status}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n${results.failed === 0 ? '✅ All tests passed!' : '❌ Some tests failed'}\n`);

  process.exit(results.failed > 0 ? 1 : 0);
}

runTests().catch(console.error);
