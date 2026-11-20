// app/api/auth/register/route.js
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User, Branch } from '@/models';
import { signToken } from '@/lib/jwt';
import { validateRegister } from '@/lib/validators';

export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json().catch(() => ({}));
    const { fullName, phone, email, password } = body;

    // 1. validate
    const { valid, errors } = validateRegister({ fullName, phone, email, password });
    if (!valid) {
      return NextResponse.json(
        { error: 'ማረጋገጫ አልተሳካም', errors },
        { status: 400 }
      );
    }

    // 2. duplicate phone
    const phoneExists = await User.findOne({ phone }).lean();
    if (phoneExists) {
      return NextResponse.json(
        { error: 'ይህ ስልክ ቁጥር ቀድሞ ተመዝግቧል' },
        { status: 409 }
      );
    }

    // 3. duplicate email
    if (email) {
      const emailExists = await User.findOne({ email: email.toLowerCase() }).lean();
      if (emailExists) {
        return NextResponse.json(
          { error: 'ይህ ኢሜይል ቀድሞ ተመዝግቧል' },
          { status: 409 }
        );
      }
    }

    // 4. default branch
    const branch = await Branch.findOne({ isActive: true }).sort({ createdAt: 1 }).lean();

    // 5. create user (password hashed by schema pre-save)
    const user = await User.create({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email?.toLowerCase() || undefined,
      password,
      role: 'customer',
      branch: branch?._id || null,
    });

    // 6. sign token
    const token = await signToken({ sub: user._id.toString(), role: user.role });

    // 7. response
    const safeUser = {
      _id: user._id,
      fullName: user.fullName,
      phone: user.phone,
      email: user.email,
      role: user.role,
      branch: branch ? { _id: branch._id, name: branch.name } : null,
      createdAt: user.createdAt,
    };

    const res = NextResponse.json({ user: safeUser, token }, { status: 201 });

    res.cookies.set('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return res;
  } catch (err) {
    console.error('[register]', err);
    if (err.code === 11000) {
      const field = Object.keys(err.keyValue || {})[0] || 'field';
      return NextResponse.json(
        { error: `${field} ቀድሞ ተመዝግቧል` },
        { status: 409 }
      );
    }
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors)) errs[k] = err.errors[k].message;
      return NextResponse.json(
        { error: 'ማረጋገጫ አልተሳካም', errors: errs },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: 'ምዝገባ አልተሳካም' }, { status: 500 });
  }
}