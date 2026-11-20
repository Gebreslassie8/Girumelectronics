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

    const doc = await User.findById(userId).select('settings').lean();
    if (!doc) {
      return NextResponse.json({ message: 'ተጠቃሚ አልተገኘም' }, { status: 404 });
    }

    return NextResponse.json({ settings: doc.settings || {} });
  } catch (err) {
    console.error('[GET /api/settings]', err);
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
    const incoming = body.settings && typeof body.settings === 'object' ? body.settings : body;

    const existing = await User.findById(userId).select('settings').lean();
    if (!existing) {
      return NextResponse.json({ message: 'ተጠቃሚ አልተገኘም' }, { status: 404 });
    }

    const merged = {
      ...(existing.settings || {}),
      ...incoming,
    };

    const updated = await User.findByIdAndUpdate(
      userId,
      { $set: { settings: merged } },
      { new: true }
    )
      .select('settings')
      .lean();

    return NextResponse.json({ settings: updated?.settings || merged });
  } catch (err) {
    console.error('[PATCH /api/settings]', err);
    return NextResponse.json({ message: 'ቅንብሮችን ማስቀመጥ አልተቻለም' }, { status: 400 });
  }
}