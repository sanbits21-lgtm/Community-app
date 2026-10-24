import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Each API test file starts its own MongoDB. Starting several at once crashed a worker on Windows now and then,
    // so files run one after another (a few seconds slower, never flaky).
    fileParallelism: false,
    // Upload tests write real files; keep them out of the app's own uploads folder.
    env: {
      UPLOAD_DIR: path.join(tmpdir(), 'sangha-test-uploads'),
      PRIVATE_DIR: path.join(tmpdir(), 'sangha-test-private'),
      // Like production behind a proxy: tests that send X-Forwarded-For are treated as different visitors.
      TRUST_PROXY: '1',
    },
  },
});
