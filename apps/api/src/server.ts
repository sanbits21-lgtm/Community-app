import { createApp } from './app';
import { ensureOwner } from './auth';
import { config } from './config';
import { connectDb, disconnectDb } from './db';
import { installSeedImages, seedIfEmpty } from './seed';
import { scheduleCleanup } from './maintenance';
import { syncBookedCounts } from './seats';

await connectDb();
await ensureOwner();
await syncBookedCounts();
scheduleCleanup();
if (config.demoMode) {
  console.log('[demo] DEMO MODE is ON: sample content is restored when the database is empty. Never use this for a real site.');
  installSeedImages(); // free hosts forget uploaded files on restart, so the sample photos are put back every time
}
if ((config.demoMode || !config.isProd) && (await seedIfEmpty())) console.log('[seed] empty database — added sample content');

const server = createApp().listen(config.port, () => {
  console.log(`[api] listening on http://localhost:${config.port}`);
});

async function shutdown() {
  server.close();
  await disconnectDb();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
