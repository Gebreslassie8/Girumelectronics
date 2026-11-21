import { NextResponse } from 'next/server';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import connectDB from '@/lib/db';
import { OtpCode, User } from '@/models';

const OTP_TTL_MIN = 10;
const RESEND_WINDOW_SEC = 60;
const MAX_PER_HOUR = 5;

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

async function sendResetEmail(email, code) {
  if (!resend) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV EMAIL] ${email} → OTP ${code}`);
      return { dev: true };
    }
    throw new Error('RESEND_API_KEY is not configured');
  }

  const from =
    process.env.MAIL_FROM || 'Gerum Modern Electronics Stove <onboarding@resend.dev>';

  const { error } = await resend.emails.send({
    from,
    to: [email],
    subject: 'የይለፍ ቃል ማረጋገጫ ኮድ — Gerum Modern Electronics Stove',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; border: 1px solid #e7e5e4; border-radius: 12px;">
        <h2 style="margin: 0 0 12px; color: #1c1917;">የይለፍ ቃል ማረጋገጫ ኮድ (OTP)</h2>
        <p style="margin: 0 0 16px; color: #57534e; font-size: 14px;">
          የይለፍ ቃልዎን ለመቀየር የሚከተለውን 6 አሃዝ ኮድ ይጠቀሙ (ለ${OTP_TTL_MIN} ደቂቃ ያገለግላል):
        </p>
        <div style="font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; padding: 14px; background: #fef3c7; color: #92400e; border-radius: 8px; margin-bottom: 16px;">
          ${code}
        </div>
        <p style="margin: 0; color: #78716c; font-size: 12px;">
          ይህን ጥያቄ ያላቀረቡ ከሆነ ይህን ኢሜይል ችላ ይበሉ።
        </p>
      </div>
    `,
  });

  if (error) {
    throw new Error(error.message || 'Failed to send OTP email');
  }
}

export async function POST(req) {
  try {
    await connectDB();
    const { email: rawEmail } = await req.json().catch(() => ({}));
    const email = normalizeEmail(rawEmail);

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'ትክክለኛ ኢሜይል ያስገቡ' }, { status: 400 });
    }

    // Rate limit: last code created in the last 60s
    const recent = await OtpCode.findOne({
      email,
      purpose: 'reset_password',
      createdAt: { $gt: new Date(Date.now() - RESEND_WINDOW_SEC * 1000) },
    }).sort({ createdAt: -1 });

    if (recent) {
      const wait = Math.ceil(
        (RESEND_WINDOW_SEC * 1000 - (Date.now() - recent.createdAt.getTime())) / 1000
      );
      return NextResponse.json(
        { error: `እባክዎ ${wait} ሰከንድ በኋላ ይሞክሩ` },
        { status: 429 }
      );
    }

    // Rate limit: max 5/hour
    const hourCount = await OtpCode.countDocuments({
      email,
      purpose: 'reset_password',
      createdAt: { $gt: new Date(Date.now() - 3600_000) },
    });
    if (hourCount >= MAX_PER_HOUR) {
      return NextResponse.json(
        { error: 'በሰዓቱ ብዙ ጊዜ ሞክረዋል — እባክዎ ቆይተው ይሞክሩ' },
        { status: 429 }
      );
    }

    // Do NOT reveal whether the email exists — always return 200
    const user = await User.findOne({ email });

    const code = String(crypto.randomInt(100000, 1000000));
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MIN * 60_000);

    await OtpCode.updateMany(
      { email, purpose: 'reset_password', consumed: false },
      { $set: { consumed: true } }
    );

    await OtpCode.create({ email, codeHash, purpose: 'reset_password', expiresAt });

    try {
      await sendResetEmail(email, code);
    } catch (mailErr) {
      console.error('[forgot-password] Email send failed:', mailErr.message);
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'ኢሜይል መላክ አልተሳካም' }, { status: 502 });
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