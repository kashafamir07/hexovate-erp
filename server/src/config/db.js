import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { env } from "./env.js";

let memoryServer = null;

/**
 * Connect to MongoDB. Uses MONGODB_URI when set; otherwise spins up an
 * ephemeral in-process MongoDB (mongodb-memory-server) so the project runs
 * without a local database installation (also used by the test suite).
 */
export async function connectDB() {
  let uri = env.mongoUri;

  if (!uri) {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });

  const dbName = mongoose.connection.name;
  const mode = env.mongoUri ? "MongoDB" : "in-memory MongoDB (ephemeral)";
  // eslint-disable-next-line no-console
  console.log(`[db] connected to ${mode} → ${dbName}`);
  return { uri, dbName };
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
  memoryServer = null;
}
