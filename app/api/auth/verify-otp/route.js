// app/api/auth/verify-otp/route.js
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import { signToken } from '@/lib/jwt';
import { User, OtpCode } from '@/models';

const MAX_ATTEMPTS = 5;
const RESET_TOKEN_TTL = '10m';

function normalizePhone(p) {
  const s = String(p || '').replace(/\s+/g, '').trim();
  if (/^\+?2519\d{8}$/.test(s)) return '0' + s.slice(-9);
  if (/^09\d{8}$/.test(s)) return s;
  if (/^9\d{8}$/.test(s)) return '0' + s;
  return s;
}

export async function POST(req) {
  try {
    await connectDB();

    const { phone: rawPhone, code } = await req.json().catch(() => ({}));
    const phone = normalizePhone(rawPhone);

    if (!/^09\d{8}$/.test(phone)) {
      return NextResponse.json({ error: 'ትክክለኛ ስልክ ቁጥር ያስገቡ' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(String(code || ''))) {
      return NextResponse.json({ error: '6 አሃዝ ኮድ ያስገቡ' }, { status: 400 });
    }

    const otp = await OtpCode.findOne({
      phone,
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
      return NextResponse.json({ error: 'ብዙ ጊዜ ሞክረዋል — አዲስ ኮድ ይጠይቁ' }, { status: 429 });
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

    const user = await User.findOne({ phone });
    if (!user) {
      return NextResponse.json({ error: 'የተሳሳተ ኮድ' }, { status: 400 });
    }

    // ✅ signToken from @/lib/jwt uses `jose` (already installed)
    const resetToken = await signToken(
      { sub: String(user._id), purpose: 'reset_password', phone },
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