import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { OtpCode, User } from '@/models';

const OTP_TTL_MIN = 10;
const RESEND_WINDOW_SEC = 60;
const MAX_PER_HOUR = 5;

async function connectDb() {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(process.env.MONGODB_URI);
}

function normalizePhone(p) {
  const s = String(p || '').replace(/\s+/g, '');
  if (/^\+?2519\d{8}$/.test(s)) return '0' + s.slice(-9);
  if (/^09\d{8}$/.test(s)) return s;
  if (/^9\d{8}$/.test(s)) return '0' + s;
  return s;
}

// Replace this with your SMS provider later
async function sendSms(phone, code) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV SMS] ${phone} → OTP ${code}`);
    return { dev: true };
  }
  throw new Error('SMS provider not configured');
}

export async function POST(req) {
  try {
    await connectDb();
    const { phone: rawPhone } = await req.json();
    const phone = normalizePhone(rawPhone);

    if (!/^09\d{8}$/.test(phone)) {
      return NextResponse.json({ error: 'ትክክለኛ ስልክ ቁጥር ያስገቡ' }, { status: 400 });
    }

    // Rate limit: last code created in the last 60s
    const recent = await OtpCode.findOne({
      phone,
      purpose: 'reset_password',
      createdAt: { $gt: new Date(Date.now() - RESEND_WINDOW_SEC * 1000) },
    }).sort({ createdAt: -1 });

    if (recent) {
      const wait = Math.ceil((RESEND_WINDOW_SEC * 1000 - (Date.now() - recent.createdAt.getTime())) / 1000);
      return NextResponse.json(
        { error: `እባክዎ ${wait} ሰከንድ በኋላ ይሞክሩ` },
        { status: 429 }
      );
    }

    // Rate limit: max 5/hour
    const hourCount = await OtpCode.countDocuments({
      phone,
      purpose: 'reset_password',
      createdAt: { $gt: new Date(Date.now() - 3600_000) },
    });
    if (hourCount >= MAX_PER_HOUR) {
      return NextResponse.json(
        { error: 'በሰዓቱ ብዙ ጊዜ ሞክረዋል — እባክዎ ቆይተው ይሞክሩ' },
        { status: 429 }
      );
    }

    // Do NOT reveal whether the phone exists — always return 200
    const user = await User.findOne({ phone });

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

    await OtpCode.updateMany(
      { phone, purpose: 'reset_password', consumed: false },
      { $set: { consumed: true } }
    );

    await OtpCode.create({ phone, codeHash, purpose: 'reset_password', expiresAt });

    try {
      await sendSms(phone, code);
    } catch (smsErr) {
      console.error('[forgot-password] SMS send failed:', smsErr.message);
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'SMS መላክ አልተሳካም' }, { status: 502 });
      }
    }

    const body = { ok: true };
    if (process.env.NODE_ENV !== 'production' && user) {
      body.devOtp = code;
    }
    return NextResponse.json(body);
  } catch (err) {
    console.error('[forgot-password]', err);
    return NextResponse.json({ error: 'ስህተት ተፈጥሯል' }, { status: 500 });
  }
}