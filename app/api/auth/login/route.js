// app/api/auth/login/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/models';
import { signToken } from '@/lib/jwt';

export async function POST(req) {
  try {
    await connectDB();
    const { phone, password } = await req.json().catch(() => ({}));

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'ስልክ እና ፓስወርድ ያስፈልጋሉ' },
        { status: 400 }
      );
    }

    const user = await User.findOne({ phone }).select('+password');
    if (!user || !user.isActive) {
      return NextResponse.json(
        { error: 'የተሳሳተ ስልክ ወይም ፓስወርድ' },
        { status: 401 }
      );
    }

    const ok = await user.comparePassword(password);
    if (!ok) {
      return NextResponse.json(
        { error: 'የተሳሳተ ስልክ ወይም ፓስወርድ' },
        { status: 401 }
      );
    }

    user.lastLogin = new Date();
    await user.save();

    const token = await signToken({ sub: user._id.toString(), role: user.role });

    const safeUser = {
      _id: user._id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      branch: user.branch,
      avatar: user.avatar,
      lastLogin: user.lastLogin,
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