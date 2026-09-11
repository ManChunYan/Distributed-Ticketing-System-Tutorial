import { spawn } from 'node:child_process';

type Strategy = 'DB_ONLY' | 'REDIS_GATE';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';

const TICKET_ID =
  process.env.TICKET_ID ?? '00000000-0000-0000-0000-000000000002';

const LOAD_VUS = process.env.LOAD_VUS ?? '100';

const LOAD_ITERATIONS = process.env.LOAD_ITERATIONS ?? '1000';

const TICKET_TOTAL = process.env.TICKET_TOTAL ?? '100';

const isWindows = process.platform === 'win32';

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = isWindows
      ? spawn('cmd.exe', ['/d', '/s', '/c', [command, ...args].join(' ')], {
          stdio: 'inherit',
          env: process.env,
        })
      : spawn(command, args, {
          stdio: 'inherit',
          env: process.env,
        });

    child.on('error', reject);

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(`${command} ${args.join(' ')} exited with code ${code}`),
      );
    });
  });
}

async function ensureServer() {
  console.log(`[benchmark] Checking server: ${BASE_URL}`);

  try {
    await fetch(BASE_URL);

    console.log(`[benchmark] Using existing server: ${BASE_URL}`);
  } catch {
    throw new Error(
      `Nest server is not running at ${BASE_URL}. Run pnpm start:dev first.`,
    );
  }
}

async function seed() {
  console.log('\n[benchmark] Resetting seed data...\n');

  await runCommand('pnpm', ['seed']);
}

async function configureStrategy(strategy: Strategy) {
  console.log(`[benchmark] Setting strategy: ${strategy}`);

  const response = await fetch(
    `${BASE_URL}/tickets/${TICKET_ID}/reservations/benchmark/reset`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        strategy,
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Failed to configure benchmark (${response.status}): ${body}`,
    );
  }

  console.log(`[benchmark] Strategy configured: ${strategy}`);
}

async function runK6(strategy: Strategy) {
  console.log(`\n[benchmark] Running k6: ${strategy}\n`);

  await runCommand('k6', [
    'run',

    '-e',
    `RESERVATION_STRATEGY=${strategy}`,

    '-e',
    `BASE_URL=${BASE_URL}`,

    '-e',
    `TICKET_ID=${TICKET_ID}`,

    '-e',
    `LOAD_VUS=${LOAD_VUS}`,

    '-e',
    `LOAD_ITERATIONS=${LOAD_ITERATIONS}`,

    '-e',
    `TICKET_TOTAL=${TICKET_TOTAL}`,

    'tests/load/reservation-gate.js',
  ]);
}

async function runStrategy(strategy: Strategy) {
  console.log('\n');
  console.log('='.repeat(60));
  console.log(` ${strategy}`);
  console.log('='.repeat(60));

  await seed();

  await configureStrategy(strategy);

  await runK6(strategy);
}

async function benchmark() {
  console.log('\n');
  console.log('############################################################');
  console.log('# Reservation Benchmark');
  console.log('############################################################');

  await ensureServer();

  let dbOnlyFailed = false;
  let redisGateFailed = false;

  try {
    await runStrategy('DB_ONLY');
  } catch (error) {
    dbOnlyFailed = true;

    console.error('\n[benchmark] DB_ONLY FAILED');
    console.error(error);
  }

  try {
    await runStrategy('REDIS_GATE');
  } catch (error) {
    redisGateFailed = true;

    console.error('\n[benchmark] REDIS_GATE FAILED');
    console.error(error);
  }

  console.log('\n');
  console.log('############################################################');
  console.log('# Benchmark Completed');
  console.log(`# DB_ONLY:    ${dbOnlyFailed ? 'FAILED' : 'PASSED'}`);
  console.log(`# REDIS_GATE: ${redisGateFailed ? 'FAILED' : 'PASSED'}`);
  console.log('############################################################');

  if (dbOnlyFailed || redisGateFailed) {
    process.exitCode = 1;
  }
}

benchmark().catch((error) => {
  console.error('\n[benchmark] FAILED');
  console.error(error);

  process.exit(1);
});
