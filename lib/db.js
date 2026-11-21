// // lib/db.js
// import mongoose from 'mongoose';

// let cached = global._mongoose;
// if (!cached) cached = global._mongoose = { conn: null, promise: null };

// export default async function connectDB() {
//   if (cached.conn) return cached.conn;

//   if (!cached.promise) {
//     if (!process.env.MONGODB_URI) {
//       throw new Error('MONGODB_URI is not set in .env.local');
//     }
//     cached.promise = mongoose.connect(process.env.MONGODB_URI, {
//       bufferCommands: false,
//       autoIndex: process.env.NODE_ENV !== 'production',
//     });
//   }

//   cached.conn = await cached.promise;
//   return cached.conn;
// }


// lib/db.js
import mongoose from 'mongoose';
import dns from 'node:dns'; // ✅ ይህን መስመር ይጨምሩ

// ✅ ይህን መስመር ይጨምሩ (የ Google DNS አገልጋይን ይጠቀማል)
dns.setServers(['8.8.8.8', '8.8.4.4']);

let cached = global._mongoose;
if (!cached) cached = global._mongoose = { conn: null, promise: null };

export default async function connectDB() {
  // ... ቀሪው ኮድዎ እንዳለ ይቆይ ...
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set in .env.local');
    }
    cached.promise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      autoIndex: process.env.NODE_ENV !== 'production',
    });
  }
  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
    cached.promise = null;
    console.error('[db] MongoDB connection error:', err.message);
    throw err;
  }
}