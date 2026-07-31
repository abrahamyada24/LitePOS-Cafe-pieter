let resetRequested = false;
let activeSyncs = 0;
let idleWaiters = [];

const resetInProgressError = () => {
  const error = new Error('Reset data outlet sedang berlangsung. Sinkronisasi ditunda.');
  error.code = 'DATA_RESET_IN_PROGRESS';
  error.status = 423;
  return error;
};

const enterDataSync = () => {
  if (resetRequested) throw resetInProgressError();
  activeSyncs += 1;
  let released = false;

  return () => {
    if (released) return;
    released = true;
    activeSyncs = Math.max(0, activeSyncs - 1);
    if (activeSyncs === 0) {
      const waiters = idleWaiters;
      idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  };
};

const withExclusiveDataReset = async (operation) => {
  if (resetRequested) throw resetInProgressError();
  resetRequested = true;

  try {
    if (activeSyncs > 0) {
      await new Promise((resolve) => idleWaiters.push(resolve));
    }
    return await operation();
  } finally {
    resetRequested = false;
  }
};

module.exports = {
  enterDataSync,
  withExclusiveDataReset,
};
