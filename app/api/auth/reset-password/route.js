// app/api/auth/reset-password/route.js
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import connectDB from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { User } from '@/models';

function normalizePhone(p) {
  const s = String(p || '').replace(/\s+/g, '').trim();
  if (/^\+?2519\d{8}$/.test(s)) return '0' + s.slice(-9);
  if (/^09\d{8}$/.test(s)) return s;
  if (/^9\d{8}$/.test(s)) return '0' + s;
  return s;
}

function passwordStrengthOk(pw) {
  return typeof pw === 'string' && pw.length >= 6;
}

export async function POST(req) {
  try {
    await connectDB();

    const { phone: rawPhone, token, password } = await req.json().catch(() => ({}));
    const phone = normalizePhone(rawPhone);

    if (!token) {
      return NextResponse.json({ error: 'የማረጋገጫ ቶከን የለም' }, { status: 400 });
    }
    if (!passwordStrengthOk(password)) {
      return NextResponse.json({ error: 'የይለፍ ቃል ቢያንስ 6 ፊደሎች መሆን አለበት' }, { status: 400 });
    }

    // ✅ verifyToken from @/lib/jwt uses `jose` (already installed)
    let payload;
    try {
      payload = await verifyToken(token);
    } catch {
      return NextResponse.json({ error: 'ቶከኑ ጊዜው አልፏል ወይም ትክክል አይደለም' }, { status: 400 });
    }

    if (payload.purpose !== 'reset_password' || payload.phone !== phone) {
      return NextResponse.json({ error: 'ትክክል ያልሆነ ቶከን' }, { status: 400 });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return NextResponse.json({ error: 'ተጠቃሚ አልተገኘም' }, { status: 404 });
    }

    user.password = await bcrypt.hash(password, 12);
    await user.save();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[reset-password] ERROR:', err);
    return NextResponse.json(
      { error: 'ስህተት ተፈጥሯል', detail: err.message },
      { status: 500 }
    );
  }
}