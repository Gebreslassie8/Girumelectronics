import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { User } from '@/models';
import { requireAuth } from '@/lib/auth';

export async function GET(req) {
  try {
    const { user, error } = await requireAuth(req);
    if (error) return error;

    await connectDB();
    const userId = user._id || user.id;

    const doc = await User.findById(userId)
      .select('-password')
      .populate('branch', 'name address')
      .lean();

    if (!doc) {
      return NextResponse.json({ message: 'ተጠቃሚ አልተገኘም' }, { status: 404 });
    }

    return NextResponse.json({ user: doc });
  } catch (err) {
    console.error('[GET /api/profile]', err);
    return NextResponse.json({ message: 'ስህተት ተፈጥሯል' }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { user, error } = await requireAuth(req);
    if (error) return error;

    await connectDB();
    const userId = user._id || user.id;
    const body = await req.json();

    const updateFields = {};
    if (typeof body.fullName === 'string') updateFields.fullName = body.fullName.trim();
    if (typeof body.phone === 'string') updateFields.phone = body.phone.trim();
    if (typeof body.email === 'string') updateFields.email = body.email.trim();
    if (typeof body.address === 'string') updateFields.address = body.address.trim();
    if (body.avatar !== undefined) updateFields.avatar = body.avatar;

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: updateFields },
      { new: true, runValidators: true }
    )
      .select('-password')
      .populate('branch', 'name address')
      .lean();

    if (!updated) {
      return NextResponse.json({ message: 'ተጠቃሚ አልተገኘም' }, { status: 404 });
    }

    return NextResponse.json({ user: updated });
  } catch (err) {
    if (err?.code === 11000) {
      return NextResponse.json(
        { message: 'ይህ ስልክ ወይም ኢሜይል ቀድሞ ተመዝግቧል' },
        { status: 409 }
      );
    }
    console.error('[PATCH /api/profile]', err);
    return NextResponse.json({ message: err.message || 'ስህተት ተፈጥሯል' }, { status: 400 });
  }
}