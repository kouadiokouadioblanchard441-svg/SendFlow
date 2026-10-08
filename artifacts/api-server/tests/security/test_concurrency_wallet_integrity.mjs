import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/*
 * Local, deterministic stress simulation. It does not open a database connection,
 * send HTTP requests, or touch account data. The in-memory model exercises the
 * wallet-adjustment contract; source assertions tie the model to the current
 * route's transaction, row-lock, validation, and idempotency mechanisms.
 *
 * This is not a PostgreSQL integration test: real lock/rollback behavior still
 * needs a disposable isolated test database before production approval.
 */
const adminActions = readFileSync(
  new URL("../../src/routes/admin-actions.ts", import.meta.url),
  "utf8",
);
const walletSchema = readFileSync(
  new URL("../../../../lib/db/src/schema/wallets.ts", import.meta.url),
  "utf8",
);
const transactionSchema = readFileSync(
  new URL("../../../../lib/db/src/schema/transactions.ts", import.meta.url),
  "utf8",
);
const ledgerSchema = readFileSync(
  new URL("../../../../lib/db/src/schema/wallet-ledger.ts", import.meta.url),
  "utf8",
);

class AsyncMutex {
  #tail = Promise.resolve();

  async run(operation) {
    const previous = this.#tail;
    let release;
    this.#tail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}

class WalletAdjustmentModel {
  #mutex = new AsyncMutex();
  #entries = new Map();

  constructor(balanceMinor) {
    this.balanceMinor = balanceMinor;
  }

  get entries() {
    return [...this.#entries.values()];
  }

  async adjust(request) {
    return this.#mutex.run(async () => {
      const existing = this.#entries.get(request.idempotencyKey);
      if (existing) {
        const sameRequest =
          existing.userId === request.userId
          && existing.adminUserId === request.adminUserId
          && existing.direction === request.direction
          && existing.amountMinor === request.amountMinor
          && existing.reason === request.reason;
        return sameRequest
          ? { status: 200, duplicate: true, entry: existing }
          : { status: 409, duplicate: false };
      }

      if (
        !Number.isSafeInteger(request.expectedBalanceMinor)
        || request.expectedBalanceMinor < 0
        || !Number.isSafeInteger(this.balanceMinor)
        || this.balanceMinor < 0
        || !Number.isSafeInteger(request.amountMinor)
        || request.amountMinor <= 0
      ) {
        return { status: 400, duplicate: false };
      }

      if (request.expectedBalanceMinor !== this.balanceMinor) {
        return { status: 409, duplicate: false };
      }

      const balanceAfterMinor = request.direction === "credit"
        ? this.balanceMinor + request.amountMinor
        : this.balanceMinor - request.amountMinor;
      if (!Number.isSafeInteger(balanceAfterMinor) || balanceAfterMinor < 0) {
        return { status: 400, duplicate: false };
      }

      // Model the route's single transaction: publish ledger and balance together.
      const entry = {
        ...request,
        balanceBeforeMinor: this.balanceMinor,
        balanceAfterMinor,
      };
      this.#entries.set(request.idempotencyKey, entry);
      this.balanceMinor = balanceAfterMinor;
      return { status: 201, duplicate: false, entry };
    });
  }
}

function adjustment(overrides = {}) {
  return {
    userId: "test-user",
    adminUserId: "test-admin",
    direction: "debit",
    amountMinor: 1,
    reason: "Local wallet integrity stress test",
    expectedBalanceMinor: 100,
    idempotencyKey: "local-wallet-stress-key-0001",
    ...overrides,
  };
}

test("1,000 concurrent stale-balance requests cannot overdraw or lose a wallet update", async () => {
  assert.match(adminActions, /db\.transaction\(async \(tx\)/);
  assert.match(adminActions, /\.from\(walletsTable\)[\s\S]*?\.for\("update"\)/);
  assert.match(adminActions, /expectedBalanceMinor !== wallet\.balanceMinor/);

  const wallet = new WalletAdjustmentModel(100);
  const responses = await Promise.all(
    Array.from({ length: 1_000 }, (_, index) =>
      wallet.adjust(adjustment({
        idempotencyKey: `local-wallet-concurrent-${String(index).padStart(4, "0")}`,
      }))
    ),
  );

  assert.equal(responses.filter((response) => response.status === 201).length, 1);
  assert.equal(responses.filter((response) => response.status === 409).length, 999);
  assert.equal(wallet.balanceMinor, 99);
  assert.equal(wallet.entries.length, 1);
  assert.ok(wallet.balanceMinor >= 0);
});

test("1,000 replays of one idempotency key create only one ledger effect", async () => {
  assert.match(ledgerSchema, /idempotencyKey:[\s\S]*?\.unique\(\)/);
  assert.match(transactionSchema, /idempotencyKey:[\s\S]*?\.unique\(\)/);
  assert.match(adminActions, /walletLedgerTable\.idempotencyKey, adjustment\.idempotencyKey/);
  assert.match(adminActions, /existing\.amountMinor !== adjustment\.amountMinor/);

  const wallet = new WalletAdjustmentModel(100);
  const request = adjustment({ amountMinor: 7 });
  const responses = await Promise.all(
    Array.from({ length: 1_000 }, () => wallet.adjust(request)),
  );

  assert.equal(responses.filter((response) => response.status === 201).length, 1);
  assert.equal(responses.filter((response) => response.status === 200 && response.duplicate).length, 999);
  assert.equal(wallet.balanceMinor, 93);
  assert.equal(wallet.entries.length, 1);

  const reusedKeyWithDifferentAmount = await wallet.adjust({
    ...request,
    amountMinor: 8,
  });
  assert.equal(reusedKeyWithDifferentAmount.status, 409);
  assert.equal(wallet.balanceMinor, 93);
  assert.equal(wallet.entries.length, 1);
});

test("malformed and out-of-range values do not mutate wallet state; database constraints must also exist", async () => {
  assert.match(adminActions, /CreateAdminWalletAdjustmentBody\.safeParse\(req\.body\)/);
  assert.match(adminActions, /Number\.isSafeInteger\(adjustment\.amountMinor\)/);
  assert.match(adminActions, /balanceAfterMinor < 0/);

  const wallet = new WalletAdjustmentModel(100);
  const malformed = [
    adjustment({ amountMinor: 0 }),
    adjustment({ amountMinor: -1 }),
    adjustment({ amountMinor: 1.5 }),
    adjustment({ amountMinor: Number.MAX_SAFE_INTEGER + 1 }),
    adjustment({ amountMinor: 101 }),
  ];
  for (const request of malformed) {
    assert.notEqual((await wallet.adjust(request)).status, 201);
  }
  assert.equal(wallet.balanceMinor, 100);
  assert.equal(wallet.entries.length, 0);

  // Red baseline: current application validation exists, but SQL-level checks do not.
  assert.match(walletSchema, /check\([\s\S]*?balanceMinor[\s\S]*?>=\s*0/);
  assert.match(transactionSchema, /check\([\s\S]*?amountMinor[\s\S]*?>\s*0/);
  assert.match(transactionSchema, /check\([\s\S]*?feeMinor[\s\S]*?>=\s*0/);
  assert.match(ledgerSchema, /check\([\s\S]*?amountMinor[\s\S]*?>\s*0/);
});
