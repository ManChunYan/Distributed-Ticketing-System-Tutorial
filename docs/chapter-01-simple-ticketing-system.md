# Chapter 1 - Simple Ticketing System

Tag: `0.1.0`

Stack: NestJS / PostgreSQL / Docker Compose / k6

## Goal

Build the simplest possible ticket-purchasing flow and observe what happens when
many requests try to purchase the same ticket concurrently.

This chapter intentionally keeps the implementation unsafe so the overselling
problem and its underlying race condition are easy to reproduce.

## Architecture

```text
Client -> NestJS -> PostgreSQL
```

## Purchase Flow

```text
Read Ticket -> Check Stock -> Decrease Stock -> Create Order
```

The flow reads the current ticket stock, checks whether inventory is available,
decreases the stock, and then creates an order.

Under concurrent requests, multiple requests can read and pass the stock check
before another request finishes writing its update.

## Run the Benchmark

Complete the setup in the root [README](../README.md) and make sure the server is running.

In another terminal, from `apps/server`, seed the database:

```bash
pnpm run seed
```

The seed script creates one event with ticket id
`00000000-0000-0000-0000-000000000002` and 100 available tickets.

Run the load test:

```bash
pnpm run load:test
```

## Test Scenario

```text
Tickets:        100
Requests:       1,000
Virtual users:  100
```

## Example Result

```text
========== Overselling Result ==========
Initial tickets:      100
Created orders:       1000
Remaining stock:      81

OVERSELLING DETECTED
Oversold orders:      900
========================================
```

The exact remaining stock can vary between runs because requests are executing concurrently.
The important observation is that the number of created orders can exceed the available ticket inventory.

## Why Overselling Happens

The purchase operation uses a non-transactional read-check-write flow.

Multiple requests can read the same stock value before any of them finishes the
corresponding update. They can therefore all pass the availability check and
continue creating orders even though the inventory should already be exhausted.

This is a race condition.

## Scope

This implementation is intentionally not production-safe. The goal of this
chapter is to make the concurrency problem visible before introducing mechanisms
that safely coordinate concurrent updates.

## Next

How can the database safely handle concurrent updates?
