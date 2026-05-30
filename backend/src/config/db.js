import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { AsyncLocalStorage } from 'node:async_hooks';

dotenv.config();

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  console.error("Error: MONGODB_URI is not set in environment variables");
  process.exit(1);
}

console.log("Connecting to MongoDB via compatibility layer...");
const client = new MongoClient(mongoUri);
await client.connect();
console.log("MongoDB compatibility layer connected successfully!");
const mongoDb = client.db();

const transactionStorage = new AsyncLocalStorage();

// Firestore FieldValue mock classes
class IncrementFieldValue {
  constructor(val) {
    this.val = val;
  }
}

class ArrayUnionFieldValue {
  constructor(vals) {
    this.vals = vals;
  }
}

class ArrayRemoveFieldValue {
  constructor(vals) {
    this.vals = vals;
  }
}

class DeleteFieldValue {}

class ServerTimestampFieldValue {}

const FieldValue = {
  increment: (val) => new IncrementFieldValue(val),
  arrayUnion: (...vals) => new ArrayUnionFieldValue(vals),
  arrayRemove: (...vals) => new ArrayRemoveFieldValue(vals),
  delete: () => new DeleteFieldValue(),
  serverTimestamp: () => new ServerTimestampFieldValue(),
};

const admin = {
  apps: [{ name: '[DEFAULT]' }],
  firestore: {
    FieldValue
  }
};

// Translates Firestore-style update data to MongoDB update operators
function translateUpdateData(data) {
  const setObj = {};
  const incObj = {};
  const addToSetObj = {};
  const pullObj = {};
  const unsetObj = {};

  for (const [key, val] of Object.entries(data)) {
    if (val instanceof IncrementFieldValue) {
      incObj[key] = val.val;
    } else if (val instanceof ArrayUnionFieldValue) {
      addToSetObj[key] = { $each: val.vals };
    } else if (val instanceof ArrayRemoveFieldValue) {
      pullObj[key] = { $in: val.vals };
    } else if (val instanceof DeleteFieldValue) {
      unsetObj[key] = "";
    } else if (val instanceof ServerTimestampFieldValue) {
      setObj[key] = new Date();
    } else {
      setObj[key] = val;
    }
  }

  const update = {};
  if (Object.keys(setObj).length > 0) update.$set = setObj;
  if (Object.keys(incObj).length > 0) update.$inc = incObj;
  if (Object.keys(addToSetObj).length > 0) update.$addToSet = addToSetObj;
  if (Object.keys(pullObj).length > 0) update.$pull = pullObj;
  if (Object.keys(unsetObj).length > 0) update.$unset = unsetObj;

  return update;
}

// Mimics a Firestore DocumentReference
class DocumentReference {
  constructor(collectionName, docId) {
    this.collectionName = collectionName;
    this.id = docId;
  }

  async get() {
    const session = transactionStorage.getStore();
    const doc = await mongoDb.collection(this.collectionName).findOne({ _id: this.id }, { session });
    return new DocumentSnapshot(this.id, doc);
  }

  async update(data) {
    const session = transactionStorage.getStore();
    const update = translateUpdateData(data);
    await mongoDb.collection(this.collectionName).updateOne({ _id: this.id }, update, { upsert: false, session });
  }

  async set(data, options = {}) {
    const session = transactionStorage.getStore();
    if (options.merge) {
      const update = translateUpdateData(data);
      await mongoDb.collection(this.collectionName).updateOne({ _id: this.id }, update, { upsert: true, session });
    } else {
      const doc = { _id: this.id, ...data };
      await mongoDb.collection(this.collectionName).replaceOne({ _id: this.id }, doc, { upsert: true, session });
    }
  }

  async delete() {
    const session = transactionStorage.getStore();
    await mongoDb.collection(this.collectionName).deleteOne({ _id: this.id }, { session });
  }
}

// Mimics a Firestore DocumentSnapshot
class DocumentSnapshot {
  constructor(id, doc) {
    this.id = id;
    this._doc = doc;
    this.exists = doc !== null && doc !== undefined;
  }

  data() {
    if (!this._doc) return undefined;
    const { _id, ...rest } = this._doc;
    return rest;
  }

  get(field) {
    if (!this._doc) return undefined;
    return this._doc[field];
  }
}

// Mimics a Firestore QuerySnapshot
class QuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.size = docs.length;
    this.empty = docs.length === 0;
  }

  forEach(callback) {
    this.docs.forEach(callback);
  }
}

// Mimics a Firestore CollectionReference / Query
class CollectionReference {
  constructor(collectionName, queryObj = {}) {
    this.collectionName = collectionName;
    this.queryObj = {
      filter: queryObj.filter || {},
      sort: queryObj.sort || null,
      limit: queryObj.limit || null,
      offset: queryObj.offset || null,
      projection: queryObj.projection || null
    };
  }

  doc(id) {
    const docId = id !== undefined ? id.toString() : Math.random().toString(36).substring(2, 15);
    return new DocumentReference(this.collectionName, docId);
  }

  where(field, op, value) {
    const newFilter = { ...this.queryObj.filter };

    if (op === '==') {
      newFilter[field] = value;
    } else if (op === '>') {
      newFilter[field] = { ...newFilter[field], $gt: value };
    } else if (op === '<') {
      newFilter[field] = { ...newFilter[field], $lt: value };
    } else if (op === '>=') {
      newFilter[field] = { ...newFilter[field], $gte: value };
    } else if (op === '<=') {
      newFilter[field] = { ...newFilter[field], $lte: value };
    } else if (op === 'in') {
      newFilter[field] = { ...newFilter[field], $in: value };
    } else if (op === 'array-contains') {
      newFilter[field] = value;
    }

    return new CollectionReference(this.collectionName, {
      ...this.queryObj,
      filter: newFilter
    });
  }

  orderBy(field, dir = 'asc') {
    const sortObj = this.queryObj.sort || {};
    sortObj[field] = dir === 'desc' ? -1 : 1;
    return new CollectionReference(this.collectionName, {
      ...this.queryObj,
      sort: sortObj
    });
  }

  limit(num) {
    return new CollectionReference(this.collectionName, {
      ...this.queryObj,
      limit: num
    });
  }

  offset(num) {
    return new CollectionReference(this.collectionName, {
      ...this.queryObj,
      offset: num
    });
  }

  select(...fields) {
    const projection = {};
    fields.forEach(f => {
      projection[f] = 1;
    });
    return new CollectionReference(this.collectionName, {
      ...this.queryObj,
      projection
    });
  }

  startAfter(lastDoc) {
    const lastId = lastDoc instanceof DocumentSnapshot ? lastDoc.id : (lastDoc?.id || lastDoc);
    const newFilter = { ...this.queryObj.filter };
    let newSort = this.queryObj.sort ? { ...this.queryObj.sort } : null;

    if (this.queryObj.sort && Object.keys(this.queryObj.sort).length > 0) {
      const sortField = Object.keys(this.queryObj.sort)[0];
      const sortDir = this.queryObj.sort[sortField];
      const lastVal = lastDoc instanceof DocumentSnapshot ? lastDoc.get(sortField) : null;
      const normalizedLastVal = lastVal === undefined ? null : lastVal;

      // Secondary sort is always _id: 1
      if (!newSort._id) {
        newSort = { ...newSort, _id: 1 };
      }

      const gtOrLt = sortDir === 1 ? '$gt' : '$lt';
      const orConditions = [
        { [sortField]: { [gtOrLt]: normalizedLastVal } },
        { [sortField]: normalizedLastVal, _id: { $gt: lastId } }
      ];

      if (newFilter.$and) {
        newFilter.$and.push({ $or: orConditions });
      } else if (Object.keys(newFilter).length > 0) {
        const existingConditions = Object.entries(newFilter).map(([k, v]) => ({ [k]: v }));
        existingConditions.forEach(cond => {
          const k = Object.keys(cond)[0];
          delete newFilter[k];
        });
        newFilter.$and = [...existingConditions, { $or: orConditions }];
      } else {
        newFilter.$or = orConditions;
      }
    } else {
      newFilter._id = { $gt: lastId };
      newSort = { _id: 1 };
    }

    return new CollectionReference(this.collectionName, {
      ...this.queryObj,
      filter: newFilter,
      sort: newSort
    });
  }

  async add(data) {
    const session = transactionStorage.getStore();
    const id = Math.random().toString(36).substring(2, 15);
    const doc = { _id: id, ...data };
    await mongoDb.collection(this.collectionName).insertOne(doc, { session });
    return new DocumentReference(this.collectionName, id);
  }

  async get() {
    const session = transactionStorage.getStore();
    const options = { session };
    if (this.queryObj.projection) {
      options.projection = this.queryObj.projection;
    }
    let cursor = mongoDb.collection(this.collectionName).find(this.queryObj.filter, options);
    if (this.queryObj.sort) {
      cursor = cursor.sort(this.queryObj.sort);
    }
    if (this.queryObj.offset) {
      cursor = cursor.skip(this.queryObj.offset);
    }
    if (this.queryObj.limit) {
      cursor = cursor.limit(this.queryObj.limit);
    }
    const docs = await cursor.toArray();
    const snapshots = docs.map(d => new DocumentSnapshot(d._id, d));
    return new QuerySnapshot(snapshots);
  }

  count() {
    return {
      get: async () => {
        const session = transactionStorage.getStore();
        const count = await mongoDb.collection(this.collectionName).countDocuments(this.queryObj.filter, { session });
        return {
          data: () => ({ count }),
          count
        };
      }
    };
  }
}

// Mimics a Firestore Transaction
class Transaction {
  async get(docRef) {
    return docRef.get();
  }

  update(docRef, data) {
    return docRef.update(data);
  }

  set(docRef, data, options) {
    return docRef.set(data, options);
  }

  delete(docRef) {
    return docRef.delete();
  }
}

// Mimics a Firestore WriteBatch
class WriteBatch {
  constructor() {
    this.ops = [];
  }

  set(docRef, data, options = {}) {
    this.ops.push({ type: 'set', docRef, data, options });
    return this;
  }

  update(docRef, data) {
    this.ops.push({ type: 'update', docRef, data });
    return this;
  }

  delete(docRef) {
    this.ops.push({ type: 'delete', docRef });
    return this;
  }

  async commit() {
    for (const op of this.ops) {
      if (op.type === 'set') {
        await op.docRef.set(op.data, op.options);
      } else if (op.type === 'update') {
        await op.docRef.update(op.data);
      } else if (op.type === 'delete') {
        await op.docRef.delete();
      }
    }
  }
}

const db = {
  collection: (name) => new CollectionReference(name),
  batch: () => new WriteBatch(),
  runTransaction: async (updateFunction) => {
    try {
      const session = client.startSession();
      try {
        let result;
        await session.withTransaction(async () => {
          result = await transactionStorage.run(session, async () => {
            const transaction = new Transaction();
            return updateFunction(transaction);
          });
        });
        return result;
      } catch (err) {
        if (err.message && (err.message.includes('replica set') || err.message.includes('transaction') || err.message.includes('standalone'))) {
          // Fallback to sessionless in standalone
          const transaction = new Transaction();
          return updateFunction(transaction);
        }
        throw err;
      } finally {
        await session.endSession();
      }
    } catch (sessionErr) {
      // Graceful fallback to sessionless if startSession fails
      const transaction = new Transaction();
      return updateFunction(transaction);
    }
  }
};

const auth = null;

export { db, auth, mongoDb };
export default admin;

