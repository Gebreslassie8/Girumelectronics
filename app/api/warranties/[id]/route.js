// app/api/warranties/[id]/route.js
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { Warranty } from '@/models';
import { requireRole } from '@/lib/auth';

// ============================================================
// PATCH — update warranty
// ============================================================
export async function PATCH(req, ctx) {
  try {
    const { error } = await requireRole(req, 'admin', 'owner', 'seller', 'cashier');
    if (error) return error;

    await connectDB();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ትክክል ያልሆነ መለያ' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));

    const allowed = [
      'order', 'product', 'itemType', 'customerName', 'customerPhone',
      'startDate', 'endDate', 'durationMonths', 'status', 'branch', 'notes',
    ];
    const updates = {};
    for (const k of allowed) {
      if (body[k] !== undefined) updates[k] = body[k];
    }

    if (updates.startDate) updates.startDate = new Date(updates.startDate);
    if (updates.endDate)   updates.endDate   = new Date(updates.endDate);
    if (updates.durationMonths) updates.durationMonths = Number(updates.durationMonths);

    // Optional: add a claim
    if (body.addClaim) {
      const current = await Warranty.findById(id).lean();
      if (!current) return NextResponse.json({ error: 'ዋስትና አልተገኘም' }, { status: 404 });
      updates.claimHistory = [
        ...(current.claimHistory || []),
        { date: new Date(), description: String(body.addClaim).trim() },
      ];
      updates.status = 'claimed';
    }

    const updated = await Warranty.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    })
      .populate('product', 'name category code')
      .populate('order', 'orderNumber')
      .populate('branch', 'name code')
      .lean();

    if (!updated) {
      return NextResponse.json({ error: 'ዋስትና አልተገኘም' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error('[warranties PATCH]', err);
    return NextResponse.json({ error: err.message || 'ስህተት ተፈጥሯል' }, { status: 500 });
  }
}

// ============================================================
// DELETE — remove warranty
// ============================================================
export async function DELETE(req, ctx) {
  try {
    const { error } = await requireRole(req, 'admin', 'owner');
    if (error) return error;

    await connectDB();

    const { id } = await ctx.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'ትክክል ያልሆነ መለያ' }, { status: 400 });
    }

    const deleted = await Warranty.findByIdAndDelete(id).lean();
    if (!deleted) {
      return NextResponse.json({ error: 'ዋስትና አልተገኘም' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, _id: id });
  } catch (err) {
    console.error('[warranties DELETE]', err);
    return NextResponse.json({ error: err.message || 'ስህተት ተፈጥሯል' }, { status: 500 });
  }
}