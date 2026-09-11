# Chapter 2 - Database Concurrency Control

Tag: `0.2.0`

Stack: NestJS / PostgreSQL / k6

## 1. Problem

Chapter 1 showed that a read-check-write flow is unsafe under concurrent requests:

```text
SELECT
  ↓
CHECK
  ↓
UPDATE
```

For this chapter, the correctness target uses the same workload as Chapter 1:

```text
Available tickets:     100
Virtual users:          100
Total requests:       1,000
Successful orders:     exactly 100
Overselling:            0
```

The database must coordinate concurrent updates so multiple requests cannot consume
the same inventory.

There are several common approaches:

```text
Pessimistic Lock
Optimistic Lock
Atomic Update
```

This chapter compares the ideas behind these approaches, then implements the one
that best matches the current ticket-decrement workload.

## 2. Reproduce

Use the same workload from Chapter 1 after replacing the naive read-check-write flow
with the conditional atomic update.

```text
Tickets:        100
Virtual users:  100
Total requests: 1,000
```

Run the same k6 load test and compare the final state.

Expected result:

```text
Successful orders: 100
Remaining tickets:   0
Overselling:          0
```

The goal of this chapter is correctness: concurrent requests must not create more
orders than the available inventory.

Performance-oriented load profiles, including larger 5,000-request and 50,000+
request scenarios, are covered later in the dedicated load-testing chapter.

Pessimistic and optimistic locking are discussed below as alternative concurrency
control techniques, but the current implementation does not keep separate runnable
strategy classes for them.

## 3. Why It Happens

The real business operation is:

> Decrease inventory by one only when inventory is still available.

The condition check and the update must therefore be coordinated atomically.

### Pessimistic Lock

A pessimistic approach can explicitly lock the row before modifying it:

```sql
SELECT *
FROM tickets
WHERE id = $1
FOR UPDATE;
```

Conceptually:

```text
Request A ── LOCK ────────── COMMIT
Request B ───────── WAIT ─── LOCK
Request C ───────── WAIT ─────────
```

Advantages:

```text
Strong consistency
Easy to reason about
```

Trade-offs:

```text
Blocking
Lock contention
Long transaction risk
Hot-row throughput limitation
```

### Optimistic Lock

An optimistic approach can add a version field and only update when the version is
unchanged:

```sql
UPDATE tickets
SET
    remaining = remaining - 1,
    version = version + 1
WHERE id = $1
  AND version = $2;
```

If another request has already changed the row:

```text
affected rows = 0
```

The application must detect the conflict and retry.

This can work well when conflicts are uncommon. In a flash-sale workload, however,
many requests compete for the same inventory row, so conflicts and retries can
become frequent.

### Atomic Update

For the current business rule, the availability check and decrement can be combined
into one SQL statement:

```sql
UPDATE tickets
SET remaining = remaining - 1
WHERE id = $1
  AND remaining > 0
RETURNING remaining;
```

This removes the application-level sequence:

```text
READ -> CHECK -> WRITE
```

for this specific inventory operation.

Only a request that successfully updates the row is allowed to continue creating
an order.

## 4. Solution

For this tutorial, the implementation uses a conditional atomic update:

```sql
UPDATE tickets
SET remaining = remaining - 1
WHERE id = $1
  AND remaining > 0
RETURNING remaining;
```

This does **not** mean atomic updates are always better than pessimistic or
optimistic locking.

For this workload, the business invariant is a simple conditional decrement on a
single inventory row. Putting the condition and mutation into one database
operation is the simplest way to preserve that invariant.

If later business logic spans multiple rows or requires more complex invariants,
the appropriate concurrency strategy may be different.

## 5. Implementation

The current implementation keeps the solution intentionally small. It does not add
separate strategy classes for pessimistic, optimistic, and atomic locking.

Instead, `purchase()` directly performs the selected atomic update inside a database
transaction:

```ts
return this.dataSource.transaction(async (manager) => {
  const result = await manager.query(
    `
    UPDATE tickets
    SET remaining = remaining - 1
    WHERE id = $1
      AND remaining > 0
    RETURNING remaining
    `,
    [ticketId],
  );

  const affectedRows = result[1];

  if (affectedRows === 0) {
    throw new ConflictException("Ticket sold out");
  }

  const orderRepository = manager.getRepository(Order);

  const order = orderRepository.create({
    ticketId,
    userId,
    status: "CONFIRMED",
  });

  return orderRepository.save(order);
});
```

For PostgreSQL, the raw query result contains the returned rows and the affected-row
count. The implementation uses the affected-row count to determine whether the
conditional update succeeded:

```text
affectedRows = 1  -> inventory was decremented
 affectedRows = 0 -> no available inventory matched the condition
```

The inventory decrement and order creation are in the same transaction:

```text
BEGIN
  ↓
Atomic inventory decrement
  ↓
Create order
  ↓
COMMIT
```

If order creation fails, the transaction rolls back the inventory decrement as
well.

The purchase flow also no longer needs to load the ticket before decrementing it.
The database evaluates `remaining > 0` as part of the `UPDATE` itself.

## 6. Verification

Use the Chapter 1 implementation as the unsafe baseline and Chapter 2 as the fixed
implementation.

| Version   | Inventory Update          | Expected Overselling |
| --------- | ------------------------- | -------------------- |
| Chapter 1 | Read -> Check -> Write    | YES                  |
| Chapter 2 | Conditional Atomic Update | NO                   |

Run the same load-test workload and verify the final database state.

With 100 available tickets and 1,000 purchase attempts, the expected result is:

```text
Successful orders:  100
Remaining tickets:    0
Overselling:           0
```

Verify the number of created orders directly:

```sql
SELECT COUNT(*) FROM orders;
```

The important correctness invariant is:

```text
orders <= initial ticket inventory
remaining >= 0
```

For the standard test case:

```text
orders = 100
remaining = 0
```

Performance numbers such as RPS, P95, and P99 should come from the actual benchmark
environment rather than being hard-coded into the documentation.

## 7. Trade-offs & Next Problem

After replacing the read-check-write flow with the conditional atomic update:

```text
✓ No overselling
✓ PostgreSQL remains the source of truth
✓ Inventory decrement and order creation share one transaction boundary
✓ Concurrent inventory updates preserve the stock invariant
```

But requests still converge on the same popular inventory row:

```text
50,000 Requests
       │
       ▼
UPDATE tickets
       │
       ▼
tickets.id = 123
```

Even requests that will eventually receive `Ticket sold out` still reach PostgreSQL.

That leads to the next questions:

> Do requests that are almost certain to be rejected as sold out all need to reach PostgreSQL?

> Should a real ticketing system immediately purchase a ticket, or reserve it first?

Next: **Chapter 3 - Redis Admission Gate & Reservation**
