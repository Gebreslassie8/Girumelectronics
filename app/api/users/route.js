import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { User } from '@/models';
import { requireRole } from '@/lib/auth';

// ============================================================
// GET — list users (admin/owner only)
// ============================================================
export async function GET(req) {
  const { error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  await connectDB();
  const users = await User.find({})
    .select('-password')
    .populate('branch', 'name code')
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json(users);
}

// ============================================================
// POST — create a new user (INCLUDING SELLER)
// ============================================================
export async function POST(req) {
  try {
    // 1. Auth: admin/owner only
    const { error, user: authUser } = await requireRole(req, 'admin', 'owner');
    if (error) return error;

    await connectDB();

    // 2. Parse + validate
    const body = await req.json().catch(() => ({}));
    const {
      fullName, phone, email, password,
      role, branch, address, isActive,
    } = body || {};

    if (!fullName || !fullName.trim()) {
      return NextResponse.json({ error: 'ሙሉ ስም ያስፈልጋል' }, { status: 400 });
    }
    if (!phone || !phone.trim()) {
      return NextResponse.json({ error: 'ስልክ ቁጥር ያስፈልጋል' }, { status: 400 });
    }
    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'የይለፍ ቃል ቢያንስ 6 ፊደሎች መሆን አለበት' },
        { status: 400 }
      );
    }
    if (!['admin', 'seller', 'cashier', 'storekeeper', 'customer', 'owner'].includes(role)) {
      return NextResponse.json({ error: 'ትክክል ያልሆነ ሚና' }, { status: 400 });
    }

    // 3. Duplicate phone check
    const exists = await User.findOne({ phone: phone.trim() });
    if (exists) {
      return NextResponse.json(
        { error: 'ይህ ስልክ ቁጥር አስቀድሞ ተመዝግቧል' },
        { status: 400 }
      );
    }

    // 4. Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 5. Create user
    const created = await User.create({
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: (email || '').trim().toLowerCase(),
      password: passwordHash,
      role,
      branch: branch || null,
      address: (address || '').trim(),
      isActive: isActive !== false,
    });

    // 6. Return safe payload
    const safe = await User.findById(created._id)
      .select('-password')
      .populate('branch', 'name code')
      .lean();

    return NextResponse.json(safe, { status: 201 });
  } catch (err) {
    console.error('[users POST]', err);
    if (err.code === 11000) {
      return NextResponse.json(
        { error: 'ይህ ስልክ ወይም ኢሜይል አስቀድሞ ተመዝግቧል' },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: err.message || 'ስህተት ተፈጥሯል' }, { status: 500 });
  }
}