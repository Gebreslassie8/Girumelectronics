import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import { signToken } from '@/lib/jwt';
import { User, OtpCode } from '@/models';

const MAX_ATTEMPTS = 5;
const RESET_TOKEN_TTL = '10m';

function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(req) {
  try {
    await connectDB();

    const { email: rawEmail, code } = await req.json().catch(() => ({}));
    const email = normalizeEmail(rawEmail);

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'ትክክለኛ ኢሜይል ያስገቡ' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(String(code || ''))) {
      return NextResponse.json({ error: '6 አሃዝ ኮድ ያስገቡ' }, { status: 400 });
    }

    const otp = await OtpCode.findOne({
      email,
      purpose: 'reset_password',
      consumed: false,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otp) {
      return NextResponse.json(
        { error: 'ኮዱ አልተገኘም ወይም ጊዜው አልፏል — እንደገና ይጠይቁ' },
        { status: 400 }
      );
    }

    if (otp.attempts >= MAX_ATTEMPTS) {
      otp.consumed = true;
      await otp.save();
      return NextResponse.json(
        { error: 'ብዙ ጊዜ ሞክረዋል — አዲስ ኮድ ይጠይቁ' },
        { status: 429 }
      );
    }

    const ok = await bcrypt.compare(String(code), otp.codeHash);
    if (!ok) {
      otp.attempts += 1;
      await otp.save();
      return NextResponse.json(
        { error: `የተሳሳተ ኮድ (${MAX_ATTEMPTS - otp.attempts} ሙከራ ቀርቷል)` },
        { status: 400 }
      );
    }

    otp.consumed = true;
    await otp.save();

    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'የተሳሳተ ኮድ' }, { status: 400 });
    }

    const resetToken = await signToken(
      { sub: String(user._id), purpose: 'reset_password', email },
      RESET_TOKEN_TTL
    );

    return NextResponse.json({ ok: true, resetToken });
  } catch (err) {
    console.error('[verify-otp] ERROR:', err);
    return NextResponse.json(
      { error: 'ስህተት ተፈጥሯል', detail: err.message },
      { status: 500 }
    );
  }
}