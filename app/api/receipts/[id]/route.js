import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { Receipt } from '@/models';
import { requireAuth } from '@/lib/auth';
import { buildOwnershipFilter, canPerformAction, isAdmin } from '@/lib/permissions';

// GET /api/receipts
export async function GET(req) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const ownershipFilter = buildOwnershipFilter(user, 'receipts');
  const receipts = await Receipt.find(ownershipFilter)
    .populate('customer', 'fullName phone email')
    .populate('branch', 'name code')
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(receipts);
}

// GET /api/receipts/[id]
export async function GET_BY_ID(req, { params }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
  }

  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const receipt = await Receipt.findById(id)
    .populate('customer', 'fullName phone email')
    .populate('branch', 'name code')
    .lean();

  if (!receipt) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  }

  if (!canPerformAction(user, 'receipts', 'read', receipt)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(receipt);
}

// PATCH /api/receipts/[id]
export async function PATCH(req, { params }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
  }

  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const receipt = await Receipt.findById(id);
  if (!receipt) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  }

  if (!canPerformAction(user, 'receipts', 'update', receipt)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const allowedFields = isAdmin(user)
    ? ['status', 'paidAmount', 'balance', 'notes', 'paymentMethod', 'branch']
    : ['status', 'paidAmount', 'notes', 'paymentMethod'];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      receipt[field] = body[field];
    }
  }

  await receipt.save();
  return NextResponse.json(receipt);
}

// DELETE /api/receipts/[id]
export async function DELETE(req, { params }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid receipt ID' }, { status: 400 });
  }

  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const receipt = await Receipt.findById(id);
  if (!receipt) {
    return NextResponse.json({ error: 'Receipt not found' }, { status: 404 });
  }

  if (!canPerformAction(user, 'receipts', 'delete', receipt)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await receipt.deleteOne();
  return NextResponse.json({ ok: true });
}