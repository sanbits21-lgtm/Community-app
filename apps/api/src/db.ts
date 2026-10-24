import { mkdirSync } from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';
import { config } from './config';

let memoryServer: { stop: () => Promise<unknown> } | null = null;

/**
 * Production: MONGODB_URI. Dev without one: spin up a local mongod whose files live in
 * apps/api/.data, so data survives restarts and nobody needs Docker just to try the app.
 */
export async function connectDb(uri = config.mongoUri): Promise<string> {
  if (!uri) {
    if (config.isProd) throw new Error('MONGODB_URI must be set in production');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const dbPath = path.resolve(process.cwd(), '.data');
    mkdirSync(dbPath, { recursive: true });
    const server = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: 'wiredTiger', port: 27117 },
      binary: { version: process.env.MONGOMS_VERSION ?? '8.2.6' },
    });
    memoryServer = server;
    uri = server.getUri('sangha');
    console.log(`[db] using local dev MongoDB (data in ${dbPath})`);
  }
  await mongoose.connect(uri);
  return uri;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  await memoryServer?.stop();
}
