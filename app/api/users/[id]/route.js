import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { User } from '@/models';
import { requireRole } from '@/lib/auth';

// ============================================================
// GET — fetch a single user by id (admin/owner only)
// ============================================================
export async function GET(req, ctx) {
  try {
    const { error } = await requireRole(req, 'admin', 'owner');
    if (error) return error;

    await connectDB();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ትክክል ያልሆነ መለያ' }, { status: 400 });
    }

    const user = await User.findById(id)
      .select('-password')
      .populate('branch', 'name code')
      .lean();

    if (!user) {
      return NextResponse.json({ error: 'ተጠቃሚ አልተገኘም' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err) {
    console.error('[users/[id] GET]', err);
    return NextResponse.json({ error: 'ስህተት ተፈጥሯል' }, { status: 500 });
  }
}

// ============================================================
// PATCH — update a user (admin/owner only)
// ============================================================
export async function PATCH(req, ctx) {
  try {
    const { error } = await requireRole(req, 'admin', 'owner');
    if (error) return error;

    await connectDB();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ትክክል ያልሆነ መለያ' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    // Whitelist of updatable fields
    const allowed = ['fullName', 'phone', 'email', 'role', 'branch', 'address', 'isActive'];
    const updates = {};
    for (const k of allowed) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    // Optional password change
    if (body.password && typeof body.password === 'string') {
      if (body.password.length < 6) {
        return NextResponse.json(
          { error: 'የይለፍ ቃል ቢያንስ 6 ፊደሎች መሆን አለበት' },
          { status: 400 }
        );
      }
      updates.password = await bcrypt.hash(body.password, 12);
    }

    // Trim string fields
    if (updates.fullName) updates.fullName = updates.fullName.trim();
    if (updates.phone)    updates.phone    = updates.phone.trim();
    if (updates.email !== undefined) updates.email = (updates.email || '').trim().toLowerCase();
    if (updates.address !== undefined) updates.address = (updates.address || '').trim();

    // Validate role
    if (updates.role && !['admin', 'seller', 'cashier', 'storekeeper', 'customer', 'owner'].includes(updates.role)) {
      return NextResponse.json({ error: 'ትክክል ያልሆነ ሚና' }, { status: 400 });
    }

    // Duplicate phone check (if phone changed)
    if (updates.phone) {
      const exists = await User.findOne({ phone: updates.phone, _id: { $ne: id } });
      if (exists) {
        return NextResponse.json({ error: 'ይህ ስልክ ቁጥር አስቀድሞ ተመዝግቧል' }, { status: 400 });
      }
    }

    const updated = await User.findByIdAndUpdate(id, updates, {
      returnDocument: 'after',
      runValidators: true,
    })
      .select('-password')
      .populate('branch', 'name code')
      .lean();

    if (!updated) {
      return NextResponse.json({ error: 'ተጠቃሚ አልተገኘም' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[users/[id] PATCH]', err);
    if (err.code === 11000) {
      return NextResponse.json({ error: 'ይህ ስልክ ወይም ኢሜይል አስቀድሞ ተመዝግቧል' }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'ስህተት ተፈጥሯል' }, { status: 500 });
  }
}

// ============================================================
// DELETE — remove a user (admin/owner only)
// ============================================================
export async function DELETE(req, ctx) {
  try {
    const { error, user: authUser } = await requireRole(req, 'admin', 'owner');
    if (error) return error;

    await connectDB();

    const { id } = await ctx.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ትክክል ያልሆነ መለያ' }, { status: 400 });
    }

    // Prevent deleting yourself
    if (String(authUser._id) === String(id)) {
      return NextResponse.json(
        { error: 'የራስዎን መለያ ማጥፋት አይችሉም' },
        { status: 400 }
      );
    }

    const deleted = await User.findByIdAndDelete(id).lean();

    if (!deleted) {
      return NextResponse.json({ error: 'ተጠቃሚ አልተገኘም' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, _id: id });
  } catch (err) {
    console.error('[users/[id] DELETE]', err);
    return NextResponse.json({ error: err.message || 'ስህተት ተፈጥሯል' }, { status: 500 });
  }
}