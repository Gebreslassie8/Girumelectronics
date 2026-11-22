import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Receipt } from '@/models';
import { requireAuth } from '@/lib/auth';
import { isAdmin, resolveUserBranchId, canPerformBranchCrud } from '@/lib/permissions';

export async function GET(req) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();

  let filter = {};
  if (!isAdmin(user)) {
    if (user.role === 'customer') {
      const uid = user._id || user.id;
      filter = { $or: [{ customer: uid }, { user: uid }] };
    } else {
      const branchId = await resolveUserBranchId(user);
      if (!branchId) return NextResponse.json([]);
      filter = { branch: branchId };
    }
  }

  const receipts = await Receipt.find(filter)
    .populate('customer', 'fullName phone email')
    .populate('branch', 'name code')
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(receipts);
}

export async function POST(req) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const userBranchId = await resolveUserBranchId(user);

  if (!canPerformBranchCrud(user, userBranchId, 'create')) {
    return NextResponse.json(
      { error: 'ደረሰኝ ለመፍጠር ፈቃድ የለዎትም' },
      { status: 403 }
    );
  }

  const body = await req.json();
  const targetBranch = isAdmin(user)
    ? body.branch || null
    : userBranchId;

  const created = await Receipt.create({
    ...body,
    branch: targetBranch,
    createdBy: user._id || user.id,
  });

  const receipt = await Receipt.findById(created._id)
    .populate('customer', 'fullName phone email')
    .populate('branch', 'name code')
    .lean();

  return NextResponse.json(receipt, { status: 201 });
}