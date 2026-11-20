import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Product } from '@/models';
import { requireAuth, requireRole } from '@/lib/auth';

export async function GET(req, { params }) {
  const { id } = await params;
  const { error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const product = await Product.findById(id)
    .populate('branch', 'name code')
    .populate('createdBy', 'fullName phone')
    .lean();
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  return NextResponse.json(product);
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const { error } = await requireRole(req, 'admin', 'owner', 'seller');
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const allowed = [
      'name', 'category', 'description', 'quantity', 'unit',
      'unitPrice', 'sellingPrice', 'status', 'branch', 'image',
    ];

    for (const k of allowed) {
      if (body[k] !== undefined) {
        if (k === 'branch' && body[k] === '') {
          product[k] = null;
        } else if (['quantity', 'unitPrice', 'sellingPrice'].includes(k)) {
          product[k] = Number(body[k]) || 0;
        } else {
          product[k] = body[k];
        }
      }
    }

    // Validate selling >= unit price
    if (product.sellingPrice < product.unitPrice) {
      return NextResponse.json(
        { error: 'የመሸጫ ዋጋ ከመግዣ ዋጋ መቀነስ አይችልም' },
        { status: 400 }
      );
    }

    await product.save();

    await product.populate('branch', 'name code');
    await product.populate('createdBy', 'fullName phone');

    return NextResponse.json(product);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors)) errs[k] = err.errors[k].message;
      return NextResponse.json({ error: 'Validation failed', errors: errs }, { status: 400 });
    }
    if (err.code === 11000) {
      return NextResponse.json({ error: 'Duplicate code' }, { status: 409 });
    }
    console.error('[products:PATCH]', err);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const { error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  await connectDB();
  const product = await Product.findByIdAndDelete(id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}