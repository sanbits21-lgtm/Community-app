// Loads the real config module in a separate process, exactly as the server does at start-up.
import('../../src/config')
  .then(() => console.log('BOOTED'))
  .catch((e: Error) => {
    console.error(e.message);
    process.exit(3);
  });
