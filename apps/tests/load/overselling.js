import http from "k6/http";
import { check } from "k6";

export const options = {
  vus: 100,
  iterations: 1000,
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

const TICKET_ID = __ENV.TICKET_ID || "00000000-0000-0000-0000-000000000002";

function randomUserId() {
  const suffix = `${__VU}${__ITER}${Date.now()}`
    .replace(/\D/g, "")
    .padEnd(12, "0")
    .slice(-12);

  return `00000000-0000-4000-8000-${suffix}`;
}

export default function () {
  const payload = JSON.stringify({
    userId: randomUserId(),
  });

  const params = {
    headers: {
      "Content-Type": "application/json",
    },
  };

  const response = http.post(
    `${BASE_URL}/tickets/${TICKET_ID}/purchase`,
    payload,
    params,
  );

  check(response, {
    "status is 201 or 409": (r) => r.status === 201 || r.status === 409,
  });
}
