import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { Expense, Employee } from '@/models';
import { requireRole } from '@/lib/auth';

async function getId(context) {
  const p = context?.params;
  return (p && typeof p.then === 'function') ? (await p).id : p?.id;
}

function normalizeId(val) {
  if (!val) return null;
  if (typeof val === 'object') {
    return val._id ? String(val._id) : val.id ? String(val.id) : null;
  }
  return String(val);
}

async function resolveUserBranchId(user) {
  const fromUser = normalizeId(user?.branch);
  if (fromUser && mongoose.Types.ObjectId.isValid(fromUser)) {
    return fromUser;
  }
  const userId = normalizeId(user?._id || user?.id);
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    const emp = await Employee.findOne({ user: userId }).select('branch').lean();
    const fromEmp = normalizeId(emp?.branch);
    if (fromEmp && mongoose.Types.ObjectId.isValid(fromEmp)) {
      return fromEmp;
    }
  }
  return null;
}

export async function GET(req, context) {
  const { user, error } = await requireRole(req, 'admin', 'owner', 'seller');
  if (error) return error;

  await connectDB();
  const id = await getId(context);
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 });
  }

  const doc = await Expense.findById(id).lean();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!['admin', 'owner'].includes(user.role)) {
    const userBranchId = await resolveUserBranchId(user);
    const docBranchId = normalizeId(doc.branch);
    if (!userBranchId || !docBranchId || userBranchId !== docBranchId) {
      return NextResponse.json({ error: 'ፍቃድ የለዎትም' }, { status: 403 });
    }
  }
  return NextResponse.json(doc);
}

export async function PATCH(req, context) {
  const { user, error } = await requireRole(req, 'admin', 'owner', 'seller');
  if (error) return error;

  try {
    await connectDB();
    const id = await getId(context);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 });
    }

    const existing = await Expense.findById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!['admin', 'owner'].includes(user.role)) {
      const userBranchId = await resolveUserBranchId(user);
      const existingBranchId = normalizeId(existing.branch);
      if (!userBranchId || !existingBranchId || userBranchId !== existingBranchId) {
        return NextResponse.json({ error: 'ፍቃድ የለዎትም' }, { status: 403 });
      }
    }

    const body = await req.json();
    const updates = {};
    if (body.paidTo        !== undefined) updates.paidTo        = String(body.paidTo).trim();
    if (body.category      !== undefined) updates.category      = body.category;
    if (body.description   !== undefined) updates.description   = body.description;
    if (body.amount        !== undefined) updates.amount        = Number(body.amount);
    if (body.paymentMethod !== undefined) updates.paymentMethod = body.paymentMethod;
    if (body.reference     !== undefined) updates.reference     = body.reference;
    if (body.expenseDate   !== undefined) updates.expenseDate   = new Date(body.expenseDate);
    if (['admin', 'owner'].includes(user.role) && body.branch !== undefined) {
      updates.branch = body.branch;
    }

    const updated = await Expense.findByIdAndUpdate(id, updates, {
      returnDocument: 'after',
      runValidators: true,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/expenses/[id] failed:', err);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req, context) {
  const { user, error } = await requireRole(req, 'admin', 'owner', 'seller');
  if (error) return error;

  try {
    await connectDB();
    const id = await getId(context);
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid expense ID' }, { status: 400 });
    }

    const existing = await Expense.findById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!['admin', 'owner'].includes(user.role)) {
      const userBranchId = await resolveUserBranchId(user);
      const existingBranchId = normalizeId(existing.branch);
      if (!userBranchId || !existingBranchId || userBranchId !== existingBranchId) {
        return NextResponse.json({ error: 'ፍቃድ የለዎትም' }, { status: 403 });
      }
    }

    await Expense.findByIdAndDelete(id);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('DELETE /api/expenses/[id] failed:', err);
    return NextResponse.json({ error: err.message || 'Delete failed' }, { status: 500 });
  }
}