import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Inventory } from '@/models';
import { requireAuth, requireRole } from '@/lib/auth';
export async function GET(req, { params }) {
  const { id } = await params;
  const { error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const item = await Inventory.findById(id)
    .populate('branch', 'name code')
    .populate('createdBy', 'fullName phone')
    .lean();
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const { error } = await requireRole(req, 'admin', 'owner', 'seller');
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();

    const patch = {};
    for (const k of ['itemType', 'quantity', 'unitPrice', 'supplier', 'description', 'branch']) {
      if (body[k] !== undefined) {
        patch[k] = body[k] === '' ? null : body[k];
      }
    }
    if (patch.quantity != null && patch.unitPrice != null) {
      patch.totalPrice = patch.quantity * patch.unitPrice;
    }

    const item = await Inventory.findByIdAndUpdate(id, patch, {
      returnDocument: 'after',
      runValidators: true,
    })
      .populate('branch', 'name code')
      .populate('createdBy', 'fullName phone')
      .lean();

    if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    return NextResponse.json(item);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors)) errs[k] = err.errors[k].message;
      return NextResponse.json({ error: 'Validation failed', errors: errs }, { status: 400 });
    }
    console.error('[inventory:PATCH]', err);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const { error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  await connectDB();
  const item = await Inventory.findByIdAndDelete(id);
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}