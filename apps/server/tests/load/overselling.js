import http from 'k6/http';
import exec from 'k6/execution';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

export const options = {
  vus: Number(__ENV.LOAD_VUS || 100),
  iterations: Number(__ENV.LOAD_ITERATIONS || 1000),

  thresholds: {
    checks: ['rate==1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TICKET_ID = __ENV.TICKET_ID || '00000000-0000-0000-0000-000000000002';

const purchaseSuccess = new Counter('purchase_success_201');
const purchaseConflict = new Counter('purchase_conflict_409');
const purchaseUnexpected = new Counter('purchase_unexpected');

// 201 = purchased
// 409 = sold out
// Both are expected outcomes for this load test.
const purchaseExpectedStatuses = http.expectedStatuses(201, 409);

function randomUserId() {
  const suffix = `${__VU}${__ITER}${Date.now()}`
    .replace(/\D/g, '')
    .padEnd(12, '0')
    .slice(-12);

  return `00000000-0000-4000-8000-${suffix}`;
}

export default function () {
  const response = http.post(
    `${BASE_URL}/tickets/${TICKET_ID}/purchase`,
    JSON.stringify({ userId: randomUserId() }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      responseCallback: purchaseExpectedStatuses,
    },
  );

  if (response.status === 201) {
    purchaseSuccess.add(1);
  } else if (response.status === 409) {
    purchaseConflict.add(1);
  } else {
    purchaseUnexpected.add(1);
  }

  check(response, {
    'status is 201 or 409': (result) =>
      result.status === 201 || result.status === 409,
  });
}

export function teardown() {
  const response = http.get(`${BASE_URL}/events/tickets/${TICKET_ID}/stats`);

  if (response.status !== 200) {
    exec.test.fail(`Failed to fetch stats: ${response.status}`);
    return;
  }

  const stats = response.json();

  console.log('');
  console.log('========== Concurrency Result ==========');
  console.log(`Initial tickets:      ${stats.initialStock}`);
  console.log(`Created orders:       ${stats.orderCount}`);
  console.log(`Remaining stock:      ${stats.remainingStock}`);
  console.log('');

  if (stats.isOversold) {
    console.log('OVERSELLING DETECTED');
    console.log(`Oversold orders:      ${stats.oversold}`);
  } else {
    console.log('NO OVERSELLING');
  }

  console.log('========================================');

  const expectedOrders = Math.min(
    Number(__ENV.LOAD_ITERATIONS || 1000),
    stats.initialStock,
  );

  if (
    stats.isOversold ||
    stats.orderCount !== expectedOrders ||
    stats.remainingStock !== stats.initialStock - expectedOrders
  ) {
    exec.test.fail(
      `Inventory correctness failed: orders=${stats.orderCount}, remaining=${stats.remainingStock}`,
    );
  }
}
