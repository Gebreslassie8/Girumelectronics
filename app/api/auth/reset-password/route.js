import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { verifyToken } from '@/lib/jwt';
import { User } from '@/models';

function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}

function passwordStrengthOk(pw) {
  return typeof pw === 'string' && pw.length >= 6;
}

export async function POST(req) {
  try {
    await connectDB();

    const { email: rawEmail, token, password } = await req.json().catch(() => ({}));
    const email = normalizeEmail(rawEmail);

    if (!token) {
      return NextResponse.json({ error: 'የማረጋገጫ ቶከን የለም' }, { status: 400 });
    }
    if (!passwordStrengthOk(password)) {
      return NextResponse.json(
        { error: 'የይለፍ ቃል ቢያንስ 6 ፊደሎች መሆን አለበት' },
        { status: 400 }
      );
    }

    let payload;
    try {
      payload = await verifyToken(token);
    } catch {
      return NextResponse.json(
        { error: 'ቶከኑ ጊዜው አልፏል ወይም ትክክል አይደለም' },
        { status: 400 }
      );
    }

    if (
      payload.purpose !== 'reset_password' ||
      normalizeEmail(payload.email) !== email
    ) {
      return NextResponse.json({ error: 'ትክክል ያልሆነ ቶከን' }, { status: 400 });
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      return NextResponse.json({ error: 'ተጠቃሚ አልተገኘም' }, { status: 404 });
    }

    user.password = password;
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