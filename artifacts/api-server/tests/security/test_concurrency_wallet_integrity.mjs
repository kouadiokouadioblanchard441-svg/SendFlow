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
) + readFileSync(new URL("../../src/services/wallet-adjustment.ts", import.meta.url), "utf8");
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
const walletMigration = readFileSync(
  new URL("../../../../lib/db/migrations/2026-10-09-wallet-safe-range-ledger-checks.sql", import.meta.url),
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
          && existing.walletId === request.walletId
          && existing.adminUserId === request.adminUserId
          && existing.direction === request.direction
          && existing.amountMinor === request.amountMinor
          && existing.reason === request.reason
          && existing.currency === request.currency
          && existing.balanceBeforeMinor === request.expectedBalanceMinor
          && Number.isSafeInteger(existing.balanceAfterMinor)
          && existing.balanceAfterMinor === (
            existing.direction === "credit"
              ? existing.balanceBeforeMinor + existing.amountMinor
              : existing.balanceBeforeMinor - existing.amountMinor
          );
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
    walletId: "test-wallet",
    adminUserId: "test-admin",
    direction: "debit",
    amountMinor: 1,
    currency: "XOF",
    reason: "Local wallet integrity stress test",
    expectedBalanceMinor: 100,
    idempotencyKey: "local-wallet-stress-key-0001",
    ...overrides,
  };
}

function checkConstraintMentions(source, field, operator) {
  const checks = [...source.matchAll(/check\s*\([\s\S]*?\)/g)].map(([block]) => block);
  return checks.some((block) => block.includes(field) && operator.test(block));
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
  assert.match(adminActions, /existing\.balanceBeforeMinor !== adjustment\.expectedBalanceMinor/);
  assert.match(adminActions, /existing\.balanceAfterMinor !== \(/);

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
  const reusedKeyWithDifferentExpectedBalance = await wallet.adjust({
    ...request,
    expectedBalanceMinor: 99,
  });
  assert.equal(reusedKeyWithDifferentExpectedBalance.status, 409);
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

  // Check that the schema and additive migration both enforce independent DB-level invariants.
  const missingConstraints = [
    !checkConstraintMentions(walletSchema, "balanceMinor", />=\s*0/) && "sf_wallets.balance_minor >= 0",
    !checkConstraintMentions(transactionSchema, "amountMinor", />\s*0/) && "sf_transactions.amount_minor > 0",
    !checkConstraintMentions(transactionSchema, "feeMinor", />=\s*0/) && "sf_transactions.fee_minor >= 0",
    !checkConstraintMentions(ledgerSchema, "amountMinor", />\s*0/) && "sf_wallet_ledger.amount_minor > 0",
    !checkConstraintMentions(ledgerSchema, "balanceBeforeMinor", />=\s*0/) && "sf_wallet_ledger.balance_before_minor >= 0",
    !checkConstraintMentions(ledgerSchema, "balanceAfterMinor", />=\s*0/) && "sf_wallet_ledger.balance_after_minor >= 0",
    !ledgerSchema.includes("balanceReconcilesCheck") && "sf_wallet_ledger balance reconciliation",
    !walletSchema.includes("9007199254740991") && "sf_wallets safe-integer maximum",
    !transactionSchema.includes("9007199254740991") && "sf_transactions safe-integer maximum",
    !ledgerSchema.includes("9007199254740991") && "sf_wallet_ledger safe-integer maximum",
    !/NOT VALID/.test(walletMigration) && "additive constraints must not scan historical rows during installation",
    !walletMigration.includes("sf_wallet_ledger_balance_reconciles_check") && "wallet ledger must reconcile its before/after balances",
  ].filter(Boolean);
  assert.deepEqual(
    missingConstraints,
    [],
    `Missing database CHECK constraints: ${missingConstraints.join(", ")}`,
  );
});
