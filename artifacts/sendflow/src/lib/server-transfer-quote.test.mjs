import assert from 'node:assert/strict';
import test from 'node:test';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import {
  transferQuoteKey, isQuoteForInput, serverQuoteAmounts,
  formatQuoteAmount, formatServerFeePercent,
  serverQuoteQueryOptions, visibleServerQuote,
} from './server-transfer-quote.ts';

const input = {
  kind: 'inter-network', sourceOperatorId: 'fixture-source', destinationOperatorId: 'fixture-destination',
  senderPhone: '+2250000000000', recipientPhone: '+2250000000001', amountMinor: 10_000, senderPaysFees: true,
};
const quote = {
  kind: input.kind, currency: 'XOF', amountMinor: input.amountMinor, senderPaysFees: true,
  feeMinor: 777, recipientAmountMinor: 10_000, totalDebitMinor: 10_777,
  feePercent: 7.77, pricingVersion: 1,
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('display copies server amounts without calculating or replacing them with entered values', () => {
  assert.deepEqual(serverQuoteAmounts(quote), { feeAmount: 777, recipientAmount: 10_000, totalDebit: 10_777 });
  assert.deepEqual(serverQuoteAmounts(undefined), { feeAmount: null, recipientAmount: null, totalDebit: null });
  assert.equal(serverQuoteAmounts({ ...quote, feeMinor: 0 }).feeAmount, 0);
  assert.equal(formatQuoteAmount(null), 'À confirmer');
  assert.equal(formatQuoteAmount(777), '777');
  assert.equal(formatServerFeePercent(7.77), '7,77 %');
});
test('intent keys cover every quote-relevant field and do not depend on property order', () => {
  const key = transferQuoteKey(input);
  assert.equal(key, transferQuoteKey(Object.fromEntries(Object.entries(input).reverse())));
  for (const patch of [{ amountMinor: 20_000 }, { senderPaysFees: false },
    { sourceOperatorId: 'other-source' }, { destinationOperatorId: 'other-destination' },
    { destinationCountryCode: 'SN' }, { senderPhone: '+2250000000002' }, { recipientPhone: '+2250000000003' },
    { kind: 'deposit' }]) {
    assert.notEqual(transferQuoteKey({ ...input, ...patch }), key);
  }
  assert.equal(transferQuoteKey(null), null);
});
test('debouncing, unavailable sessions, pending refresh and failures never expose cached totals', () => {
  const key = transferQuoteKey(input);
  const success = { isSuccess: true, isFetching: false, data: quote };
  assert.equal(visibleServerQuote(true, key, key, success), quote);
  assert.equal(visibleServerQuote(false, key, key, success), undefined);
  assert.equal(visibleServerQuote(true, key, 'old-input', success), undefined);
  assert.equal(visibleServerQuote(true, key, key, { ...success, isFetching: true }), undefined);
  assert.equal(visibleServerQuote(true, key, key, { ...success, isSuccess: false }), undefined);
  assert.equal(visibleServerQuote(true, null, null, success), undefined);
});
test('responses must match the intent and contain usable XOF amounts', () => {
  assert.equal(isQuoteForInput(input, quote), true);
  for (const patch of [{ amountMinor: 1 }, { senderPaysFees: false }, { kind: 'deposit' },
    { currency: 'EUR' }, { feeMinor: -1 }, { feeMinor: 0.5 }, { totalDebitMinor: Infinity },
    { recipientAmountMinor: 0 }, { feePercent: NaN }]) {
    assert.equal(isQuoteForInput(input, { ...quote, ...patch }), false);
  }
});
test('real QueryObserver aborts old input; a late response cannot replace the new server quote', async () => {
  const pending = [];
  const request = (data, { signal }) => new Promise((resolve) => pending.push({ data, signal, resolve }));
  const client = new QueryClient();
  const observer = new QueryObserver(client, serverQuoteQueryOptions(input, true, transferQuoteKey(input), request));
  const unsubscribe = observer.subscribe(() => {});
  try {
    await tick();
    const next = { ...input, amountMinor: 20_000 };
    observer.setOptions(serverQuoteQueryOptions(next, true, transferQuoteKey(next), request));
    await tick();
    assert.equal(pending.length, 2);
    assert.equal(pending[0].signal.aborted, true);
    const nextQuote = { ...quote, amountMinor: 20_000, recipientAmountMinor: 20_000, totalDebitMinor: 20_777 };
    pending[1].resolve(nextQuote);
    await tick();
    pending[0].resolve(quote);
    await tick();
    assert.equal(observer.getCurrentResult().data, nextQuote);
  } finally { unsubscribe(); observer.destroy(); client.clear(); }
});
test('failed refreshes invalidate the display; queries never persist or automatically retry', async () => {
  let fail = false;
  const request = async () => { if (fail) throw Object.assign(new Error('Fixture unavailable'), { status: 503 }); return quote; };
  const key = transferQuoteKey(input);
  const options = serverQuoteQueryOptions(input, true, key, request);
  assert.equal(options.retry, false);
  assert.equal(options.gcTime, 0);
  assert.equal(serverQuoteQueryOptions(input, true, 'old', request).enabled, false);
  assert.equal(serverQuoteQueryOptions(null, true, null, request).enabled, false);
  const client = new QueryClient();
  const observer = new QueryObserver(client, options);
  const unsubscribe = observer.subscribe(() => {});
  try {
    await tick();
    assert.equal(observer.getCurrentResult().data, quote);
    fail = true;
    await observer.refetch();
    assert.equal(visibleServerQuote(true, key, key, observer.getCurrentResult()), undefined);
  } finally { unsubscribe(); observer.destroy(); client.clear(); }
});
