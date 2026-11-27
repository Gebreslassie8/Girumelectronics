import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { verifyToken } from '@/lib/jwt';
import { User } from '@/models';

const globalForMongoose = globalThis;

async function connectDb() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  if (!globalForMongoose._mongooseConnectPromise) {
    globalForMongoose._mongooseConnectPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 10000,
      })
      .catch((err) => {
        globalForMongoose._mongooseConnectPromise = null;
        throw err;
      });
  }

  await globalForMongoose._mongooseConnectPromise;

  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve, reject) => {
      mongoose.connection.once('connected', resolve);
      mongoose.connection.once('error', reject);
    });
  }

  return mongoose.connection;
}

function extractToken(req) {
  const cookieToken = req.cookies.get('token')?.value;
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  return null;
}

export async function GET(req) {
  try {
    const token = extractToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let payload;
    try {
      payload = await verifyToken(token);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!payload?.sub || !mongoose.Types.ObjectId.isValid(payload.sub)) {
      return NextResponse.json({ error: 'Invalid token payload' }, { status: 401 });
    }

    await connectDb();
    const user = await User.findById(payload.sub)
      .select('-password')
      .populate('branch', 'name address')
      .lean();

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err) {
    console.error('[auth/me]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}