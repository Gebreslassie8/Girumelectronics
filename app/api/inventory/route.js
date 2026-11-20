import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Inventory } from '@/models';
import { requireAuth, requireRole } from '@/lib/auth';

export async function GET(req) {
  const { error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const items = await Inventory.find({})
    .populate('branch', 'name code')
    .populate('createdBy', 'fullName phone')
    .sort({ receivedDate: -1 })
    .lean();
  return NextResponse.json(items);
}

export async function POST(req) {
  const { error, user } = await requireRole(req, 'admin', 'owner', 'seller');
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();
    const { itemType, quantity, unitPrice, supplier, description, branch } = body;

    if (!itemType || quantity == null || unitPrice == null) {
      return NextResponse.json(
        { error: 'Missing required fields: itemType, quantity, unitPrice' },
        { status: 400 }
      );
    }

    let resolvedBranch = branch;
    if (!resolvedBranch && user.branch) {
      resolvedBranch = typeof user.branch === 'object' ? user.branch._id : user.branch;
    }
    if (!resolvedBranch) {
      return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
    }

    const year = new Date().getFullYear();
    const count = await Inventory.countDocuments({ itemCode: new RegExp('^INV-' + year + '-') });
    const itemCode = 'INV-' + year + '-' + String(count + 1).padStart(4, '0');

    const item = await Inventory.create({
      itemCode,
      itemType,
      quantity,
      unitPrice,
      totalPrice: Number(quantity) * Number(unitPrice),
      supplier: supplier || undefined,
      description: description || undefined,
      branch: resolvedBranch,
      createdBy: user._id,
      receivedDate: new Date(),
    });

    await item.populate('branch', 'name code');
    await item.populate('createdBy', 'fullName phone');

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors)) errs[k] = err.errors[k].message;
      console.error('[inventory:POST] validation:', errs);
      return NextResponse.json({ error: 'Validation failed', errors: errs }, { status: 400 });
    }
    if (err.code === 11000) {
      return NextResponse.json({ error: 'Duplicate item code, retry' }, { status: 409 });
    }
    console.error('[inventory:POST]', err);
    return NextResponse.json({ error: err.message || 'Create failed' }, { status: 500 });
  }
}