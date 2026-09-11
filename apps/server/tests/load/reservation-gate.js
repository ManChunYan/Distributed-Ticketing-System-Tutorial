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
const STRATEGY = __ENV.RESERVATION_STRATEGY || 'REDIS_GATE';

const TICKET_ID = __ENV.TICKET_ID || '00000000-0000-0000-0000-000000000002';

const reservationSuccess = new Counter('reservation_success_201');

const reservationConflict = new Counter('reservation_conflict_409');

const reservationUnexpected = new Counter('reservation_unexpected');

const expectedStatuses = http.expectedStatuses(201, 409);

function randomUserId() {
  const suffix = `${__VU}${__ITER}${Date.now()}`
    .replace(/\D/g, '')
    .padEnd(12, '0')
    .slice(-12);

  return `00000000-0000-4000-8000-${suffix}`;
}

export default function () {
  const response = http.post(
    `${BASE_URL}/tickets/${TICKET_ID}/reservations`,
    JSON.stringify({
      userId: randomUserId(),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
      },
      responseCallback: expectedStatuses,
    },
  );

  if (response.status === 201) {
    reservationSuccess.add(1);
  } else if (response.status === 409) {
    reservationConflict.add(1);
  } else {
    reservationUnexpected.add(1);
  }

  check(response, {
    'status is 201 or 409': (r) => r.status === 201 || r.status === 409,
  });
}

export function teardown() {
  const response = http.get(
    `${BASE_URL}/tickets/${TICKET_ID}/reservations/metrics`,
  );

  if (response.status !== 200) {
    exec.test.fail(`Failed to fetch reservation metrics: ${response.status}`);
    return;
  }

  const metrics = response.json();
  const expectedRequests = Number(__ENV.LOAD_ITERATIONS || 1000);
  const expectedSuccess = Math.min(
    expectedRequests,
    Number(__ENV.TICKET_TOTAL || 100),
  );
  const expectedRejected = expectedRequests - expectedSuccess;
  const expectedDbAttempts =
    STRATEGY === 'REDIS_GATE' ? expectedSuccess : expectedRequests;

  console.log('');
  console.log('========== Reservation Benchmark =========');
  console.log(`Strategy:              ${STRATEGY}`);
  console.log(`HTTP requests:         ${expectedRequests}`);
  console.log(`Expected success:      ${expectedSuccess}`);
  console.log(`Expected conflicts:    ${expectedRejected}`);
  console.log('Actual counters are included in the k6 summary.');
  console.log(`DB inventory attempts: ${metrics.dbInventoryAttempts}`);
  console.log(`Redis gate allowed:    ${metrics.gateAllowed}`);
  console.log(`Redis gate rejected:   ${metrics.gateRejected}`);
  console.log(`DB reservations:       ${metrics.reservationCount}`);
  console.log(`DB remaining:          ${metrics.remaining}`);
  console.log('===========================================');

  if (
    metrics.dbInventoryAttempts !== expectedDbAttempts ||
    metrics.reservationCount !== expectedSuccess ||
    metrics.remaining !== Number(__ENV.TICKET_TOTAL || 100) - expectedSuccess
  ) {
    exec.test.fail(
      'Reservation benchmark correctness or admission counts failed',
    );
  }
}
