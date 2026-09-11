# Chapter 3 - Redis Admission Gate & Reservation

Tag: `0.3.0`

Stack: NestJS / PostgreSQL / Redis / Lua / k6

## 1. Problem

Chapter 2 solved overselling with a conditional PostgreSQL update.

With 100 tickets and 1,000 concurrent requests, PostgreSQL can preserve the
inventory invariant:

```text
Successful requests: 100
Remaining tickets:     0
Overselling:            0
```

But all 1,000 requests still reach PostgreSQL:

```text
1,000 requests
      │
      ▼
PostgreSQL
      │
      ▼
100 succeed
900 rejected
```

The database is correct, but most sold-out requests still enter the hot
inventory path.

The question for this chapter is:

> Do requests that are already certain to fail need to reach PostgreSQL at all?

## 2. Reproduce

This chapter compares two reservation strategies using the same endpoint:

```http
POST /tickets/:ticketId/reservations
```

The workload is:

```text
Tickets:        100
Virtual users:  100
Total requests: 1,000
```

Both strategies must preserve the same final result:

```text
Reservations: 100
Remaining:      0
Overselling:    0
```

The difference is how many requests reach PostgreSQL.

### DB_ONLY

```text
1,000 requests
      │
      ▼
PostgreSQL
      │
      ├── 100 succeed
      └── 900 rejected
```

Expected database inventory attempts:

```text
~1,000
```

### REDIS_GATE

```text
1,000 requests
      │
      ▼
Redis Admission Gate
   /             \
900 rejected     100 allowed
                     │
                     ▼
                 PostgreSQL
```

Expected database inventory attempts:

```text
~100
```

Redis is not used to make the remaining-ticket query faster.

It is used to reject requests before they enter the database hot path.

## 3. Why It Happens

The PostgreSQL atomic update from Chapter 2 is still correct:

```sql
UPDATE tickets
SET remaining = remaining - 1
WHERE id = $1
  AND remaining > 0
RETURNING remaining;
```

But correctness and admission control solve different problems.

Without an admission gate, every request must still:

```text
Enter the application
        ↓
Acquire database resources
        ↓
Execute against the same inventory row
        ↓
Discover that inventory is exhausted
```

During a flash sale, many requests may already be impossible to satisfy.

Those requests do not need durable database work merely to learn that the event
is sold out.

## 4. Solution

Place Redis in front of PostgreSQL as an admission gate:

```text
Client
  │
  ▼
Redis Admission Gate
  │
  ├── no stock ──> 409 Conflict
  │
  ▼
PostgreSQL Transaction
  │
  ├── Conditional inventory decrement
  └── Create RESERVED reservation
```

The ownership rule is:

```text
Redis      = Admission / Performance Boundary
PostgreSQL = Durable Correctness Boundary
```

Redis may reject requests early, but PostgreSQL remains responsible for durable
capacity correctness.

### Redis Atomic Admission

The Redis gate uses Lua so the admission steps happen atomically:

```text
Check stock
    +
Decrease stock
    +
Create reservation lease
    +
Set TTL
```

Conceptually:

```lua
local stock = tonumber(redis.call('GET', KEYS[1]))

if not stock or stock <= 0 then
  return 0
end

redis.call('DECR', KEYS[1])

redis.call(
  'HSET',
  KEYS[2],
  'ticketId', ARGV[1],
  'userId', ARGV[2],
  'expiresAt', ARGV[3],
  'state', 'RESERVED'
)

redis.call('PEXPIRE', KEYS[2], ARGV[4])

return 1
```

A successful Redis result means:

> This request may continue to PostgreSQL.

It does not mean the durable reservation is already guaranteed.

### PostgreSQL Still Enforces Capacity

After Redis admits the request, PostgreSQL performs the same conditional update:

```sql
UPDATE tickets
SET remaining = remaining - 1
WHERE id = $1
  AND remaining > 0
RETURNING remaining;
```

Only a successful update may create a durable reservation:

```text
BEGIN
  ↓
Conditional inventory decrement
  ↓
Create reservation(status = RESERVED)
  ↓
COMMIT
```

If Redis and PostgreSQL disagree, PostgreSQL still prevents overselling.

For example:

```text
Redis stock = 2
DB stock    = 1

Request A -> DB success -> RESERVED
Request B -> DB reject  -> 409

Final DB remaining = 0
Reservations       = 1
Overselling        = 0
```

## 5. Implementation

### Reservation Flow

A successful reservation stores:

```text
status = RESERVED
expiresAt = current time + 5 minutes
```

The request flow is:

```text
Generate reservationId / expiresAt
        ↓
Apply reservation strategy
        ↓
PostgreSQL transaction
        ↓
Conditional inventory decrement
        ↓
Create RESERVED reservation
```

At this stage, confirmation, expiration, cancellation, and recovery are not yet
implemented.

### Benchmark Strategies

The benchmark supports:

```text
DB_ONLY
REDIS_GATE
```

`DB_ONLY` skips Redis:

```text
Request -> PostgreSQL
```

`REDIS_GATE` checks Redis first:

```text
Request -> Redis -> PostgreSQL
```

The running server can switch benchmark strategy through:

```http
POST /tickets/:ticketId/reservations/benchmark/reset
```

Example:

```json
{
  "strategy": "DB_ONLY"
}
```

This endpoint also resets the in-memory benchmark counters so both strategies can
run sequentially against the same server process.

This endpoint exists only for benchmark infrastructure.

### Benchmark Metrics

The benchmark reads:

```http
GET /tickets/:ticketId/reservations/metrics
```

It reports:

```text
dbInventoryAttempts
gateAllowed
gateRejected
reservationCount
remaining
```

These counters are simple in-process benchmark instrumentation, not production
observability metrics.

## 6. Verification

Start the application and keep it running:

```bash
pnpm run start:dev
```

In another terminal:

```bash
pnpm benchmark:reservation
```

The benchmark runner executes both strategies sequentially:

```text
seed
  ↓
DB_ONLY
  ↓
k6
  ↓
seed
  ↓
REDIS_GATE
  ↓
k6
```

For each run, PostgreSQL and Redis are reset to:

```text
DB stock:     100
Redis stock:  100
Reservations:   0
```

Expected logical comparison:

```text
                    DB_ONLY     REDIS_GATE
HTTP requests          1000           1000
DB attempts             1000            100
Redis allowed              0            100
Redis rejected             0            900
Reservations             100            100
Remaining                  0              0
Overselling                0              0
```

The important result is:

```text
Same correctness
+
Fewer requests entering PostgreSQL
```

k6 also reports runtime measurements such as:

```text
http_req_duration
iterations
reservation_success_201
reservation_conflict_409
```

Latency and throughput depend on the benchmark environment, so performance
numbers should come from the actual run rather than being hard-coded into this
chapter.

### Correctness Checks

The important invariants remain:

```text
reservations <= initial ticket inventory
remaining >= 0
```

The tests should verify that:

```text
Redis rejects sold-out requests before PostgreSQL
PostgreSQL still rejects Redis over-admission
DB_ONLY and REDIS_GATE produce the same durable result
```

## 7. Trade-offs & Next Problem

The Redis admission gate changes the hot path from:

```text
All requests
    ↓
PostgreSQL
```

to:

```text
All requests
    ↓
Redis
    ↓
Only admitted requests
    ↓
PostgreSQL
```

This gives us:

```text
✓ Sold-out requests can be rejected before PostgreSQL
✓ PostgreSQL remains the correctness boundary
✓ Redis reduces unnecessary database inventory attempts
✓ Reservation creation is separate from final purchase
```

But Redis and PostgreSQL do not share one transaction.

For example:

```text
Redis DECR succeeds
        ↓
Process crashes
        ↓
PostgreSQL reservation is never created
```

The two systems can temporarily disagree.

This chapter intentionally does not solve that problem.

The next question is:

> If Redis and PostgreSQL contain different reservation state, which system owns the truth and how do we safely repair the mismatch?

Next: **Chapter 4 - Reservation Consistency & Reconciliation**
