const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI || "mongodb://localhost:27017";
const client = new MongoClient(uri);
const dbName = "smarthome";

let connectPromise = null;

async function getDb() {
  if (!connectPromise) {
    connectPromise = client.connect();
  }

  await connectPromise;
  return client.db(dbName);
}

module.exports = getDb;
