import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { Receipt } from '@/models';
import { requireAuth } from '@/lib/auth';
import { isAdmin, resolveUserBranchId, canPerformBranchCrud } from '@/lib/permissions';

export async function GET(req, { params }) {
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
    return NextResponse.json({ error: 'ደረሰኝ አልተገኘም' }, { status: 404 });
  }

  const userBranchId = await resolveUserBranchId(user);
  if (!canPerformBranchCrud(user, userBranchId, 'read', receipt)) {
    return NextResponse.json(
      { error: 'ይህንን ደረሰኝ ከተመደቡበት ቅርንጫፍ ውጭ ማየት አይችሉም' },
      { status: 403 }
    );
  }

  return NextResponse.json(receipt);
}

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
    return NextResponse.json({ error: 'ደረሰኝ አልተገኘም' }, { status: 404 });
  }

  const userBranchId = await resolveUserBranchId(user);
  if (!canPerformBranchCrud(user, userBranchId, 'update', receipt)) {
    return NextResponse.json(
      { error: 'ይህንን ደረሰኝ ለማስተካከል ፈቃድ የለዎትም' },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const allowedFields = isAdmin(user)
    ? ['status', 'paidAmount', 'advanceAmount', 'remainingAmount', 'balance', 'notes', 'paymentMethod', 'branch', 'items']
    : ['status', 'paidAmount', 'advanceAmount', 'remainingAmount', 'balance', 'notes', 'paymentMethod', 'items'];

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      receipt[field] = body[field];
    }
  }

  await receipt.save();
  await receipt.populate('customer', 'fullName phone email');
  await receipt.populate('branch', 'name code');

  return NextResponse.json(receipt);
}

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
    return NextResponse.json({ error: 'ደረሰኝ አልተገኘም' }, { status: 404 });
  }

  const userBranchId = await resolveUserBranchId(user);
  if (!canPerformBranchCrud(user, userBranchId, 'delete', receipt)) {
    return NextResponse.json(
      { error: 'ይህንን ደረሰኝ ከተመደቡበት ቅርንጫፍ ውጭ መሰረዝ አይችሉም' },
      { status: 403 }
    );
  }

  await receipt.deleteOne();
  return NextResponse.json({ ok: true });
}