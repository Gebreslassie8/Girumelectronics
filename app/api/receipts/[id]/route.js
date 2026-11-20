import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Receipt, Order } from '@/models';
import { requireAuth, requireRole } from '@/lib/auth';

export async function GET(req, { params }) {
  const { id } = await params;
  const { error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const receipt = await Receipt.findById(id)
    .populate('branch', 'name code')
    .populate('order', 'orderNumber')
    .populate('issuedBy', 'fullName phone')
    .lean();
  if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  return NextResponse.json(receipt);
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const { error } = await requireRole(req, 'admin', 'owner', 'seller');
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();

    const receipt = await Receipt.findById(id);
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });

    // Handle orderNumber → order id resolution
    if (body.orderNumber !== undefined) {
      if (body.orderNumber) {
        const found = await Order.findOne({ orderNumber: body.orderNumber.trim() }).lean();
        receipt.order = found ? found._id : null;
      } else {
        receipt.order = null;
      }
    }

    const allowed = [
      'productCode', 'itemType', 'customerName', 'customerPhone', 'orderDate',
      'prepayment', 'remainingPayment', 'totalPrice',
      'appointmentDate', 'note', 'status', 'branch',
    ];

    for (const k of allowed) {
      if (body[k] !== undefined) {
        if (k === 'branch' && body[k] === '') {
          receipt[k] = null;
        } else if (['prepayment', 'remainingPayment', 'totalPrice'].includes(k)) {
          receipt[k] = Number(body[k]) || 0;
        } else {
          receipt[k] = body[k];
        }
      }
    }

    await receipt.save();

    await receipt.populate('branch', 'name code');
    await receipt.populate('order', 'orderNumber');
    await receipt.populate('issuedBy', 'fullName phone');

    return NextResponse.json(receipt);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors)) errs[k] = err.errors[k].message;
      return NextResponse.json({ error: 'Validation failed', errors: errs }, { status: 400 });
    }
    console.error('[receipts:PATCH]', err);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const { error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  await connectDB();
  const receipt = await Receipt.findByIdAndDelete(id);
  if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}