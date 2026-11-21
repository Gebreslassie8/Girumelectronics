import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/models';
import { signToken } from '@/lib/jwt';

function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}

function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

export async function POST(req) {
  try {
    await connectDB();
    const { email: rawEmail, password } = await req.json().catch(() => ({}));
    const email = normalizeEmail(rawEmail);

    if (!email || !password || !isValidEmail(email)) {
      return NextResponse.json(
        { error: 'ትክክለኛ ኢሜይል እና ፓስወርድ ያስፈልጋሉ' },
        { status: 400 }
      );
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'የተሳሳተ ኢሜይል ወይም ፓስወርድ' },
        { status: 401 }
      );
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      return NextResponse.json(
        { error: 'የተሳሳተ ኢሜይል ወይም ፓስወርድ' },
        { status: 401 }
      );
    }

    const lastLogin = new Date();
    await User.updateOne({ _id: user._id }, { $set: { lastLogin } });

    const token = await signToken({ sub: user._id.toString(), role: user.role });

    const safeUser = {
      _id: user._id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      branch: user.branch,
      avatar: user.avatar,
      lastLogin,
    };

    const res = NextResponse.json({ user: safeUser, token });
    res.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    return res;
  } catch (err) {
    console.error('[login]', err);
    return NextResponse.json({ error: 'መግቢያ አልተሳካም' }, { status: 500 });
  }
}