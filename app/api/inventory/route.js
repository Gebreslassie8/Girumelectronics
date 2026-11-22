import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { Inventory, Employee } from '@/models';
import { requireAuth } from '@/lib/auth';

function isAdminUser(user) {
  return ['admin', 'owner'].includes(user?.role);
}

async function getStorekeeperContext(user) {
  const emp = await Employee.findOne({ user: user._id || user.id })
    .select('branch permissions')
    .lean();

  const branchId = (user?.branch?._id || user?.branch)
    ? String(user.branch._id || user.branch)
    : emp?.branch
    ? String(emp.branch)
    : null;

  const perms = emp?.permissions || {};
  return { branchId, perms };
}

export async function GET(req, { params }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid inventory ID' }, { status: 400 });
  }

  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const item = await Inventory.findById(id)
    .populate('branch', 'name code')
    .populate('product', 'name code')
    .populate('createdBy', 'fullName phone')
    .lean();

  if (!item) {
    return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
  }

  if (!isAdminUser(user)) {
    const { branchId, perms } = await getStorekeeperContext(user);
    const itemBranchId = item.branch?._id
      ? String(item.branch._id)
      : item.branch
      ? String(item.branch)
      : null;

    const canSee =
      user.role === 'storekeeper' ||
      Boolean(perms.canManageInventory || perms.viewInventory || perms.manageInventory);

    if (!canSee || !branchId || itemBranchId !== branchId) {
      return NextResponse.json(
        { error: 'ይህንን የመጋዘን መረጃ ከተመደቡበት ቅርንጫፍ ውጭ ማየት አይችሉም' },
        { status: 403 }
      );
    }
  }

  return NextResponse.json(item);
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid inventory ID' }, { status: 400 });
  }

  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    await connectDB();
    const item = await Inventory.findById(id);
    if (!item) {
      return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
    }

    const admin = isAdminUser(user);
    if (!admin) {
      const { branchId, perms } = await getStorekeeperContext(user);
      const itemBranchId = item.branch ? String(item.branch) : null;
      const canEdit =
        user.role === 'storekeeper' ||
        Boolean(perms.canManageInventory || perms.editInventory || perms.manageInventory);

      if (!canEdit || !branchId || itemBranchId !== branchId) {
        return NextResponse.json(
          { error: 'ይህንን የመጋዘን መረጃ ለማስተካከል ፈቃድ የለዎትም' },
          { status: 403 }
        );
      }
    }

    const body = await req.json();
    const allowed = admin
      ? ['itemType', 'quantity', 'unitPrice', 'totalPrice', 'supplier', 'description', 'branch', 'receivedDate', 'product']
      : ['itemType', 'quantity', 'unitPrice', 'totalPrice', 'supplier', 'description', 'receivedDate', 'product'];

    for (const k of allowed) {
      if (body[k] !== undefined) {
        if ((k === 'branch' || k === 'product') && body[k] === '') {
          item[k] = null;
        } else if (['quantity', 'unitPrice', 'totalPrice'].includes(k)) {
          item[k] = Number(body[k]) || 0;
        } else {
          item[k] = body[k];
        }
      }
    }

    await item.save();
    await item.populate('branch', 'name code');
    await item.populate('product', 'name code');
    await item.populate('createdBy', 'fullName phone');

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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid inventory ID' }, { status: 400 });
  }

  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const item = await Inventory.findById(id);
  if (!item) {
    return NextResponse.json({ error: 'Inventory item not found' }, { status: 404 });
  }

  const admin = isAdminUser(user);
  if (!admin) {
    const { branchId, perms } = await getStorekeeperContext(user);
    const itemBranchId = item.branch ? String(item.branch) : null;
    const canDelete =
      user.role === 'storekeeper' ||
      Boolean(perms.canManageInventory || perms.deleteInventory || perms.manageInventory);

    if (!canDelete || !branchId || itemBranchId !== branchId) {
      return NextResponse.json(
        { error: 'ይህንን የመጋዘን መረጃ ለመሰረዝ ፈቃድ የለዎትም' },
        { status: 403 }
      );
    }
  }

  await item.deleteOne();
  return NextResponse.json({ ok: true });
}