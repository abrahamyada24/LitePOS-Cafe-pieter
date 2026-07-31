const test = require('node:test');
const assert = require('node:assert/strict');
const {
  enterDataSync,
  withExclusiveDataReset,
} = require('./dataResetCoordinator');

test('reset menunggu sinkronisasi aktif dan menolak sinkronisasi baru', async () => {
  const releaseSync = enterDataSync();
  let resetStarted = false;
  const resetPromise = withExclusiveDataReset(async () => {
    resetStarted = true;
    return 'done';
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(resetStarted, false);
  assert.throws(
    () => enterDataSync(),
    (error) => error.code === 'DATA_RESET_IN_PROGRESS' && error.status === 423
  );

  releaseSync();
  assert.equal(await resetPromise, 'done');
  assert.equal(resetStarted, true);
});
