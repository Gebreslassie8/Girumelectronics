import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Expense } from '@/models';
import { requireRole } from '@/lib/auth';

async function getId(context) {
  const p = context?.params;
  return (p && typeof p.then === 'function') ? (await p).id : p?.id;
}

export async function GET(req, context) {
  const { user, error } = await requireRole(req, 'admin', 'owner', 'seller');
  if (error) return error;

  await connectDB();
  const id = await getId(context);
  const doc = await Expense.findById(id).lean();
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!['admin', 'owner'].includes(user.role) && String(doc.branch) !== String(user.branch)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return NextResponse.json(doc);
}

export async function PATCH(req, context) {
  const { user, error } = await requireRole(req, 'admin', 'owner', 'seller');
  if (error) return error;

  try {
    await connectDB();
    const id = await getId(context);
    const existing = await Expense.findById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!['admin', 'owner'].includes(user.role) && String(existing.branch) !== String(user.branch)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
      new: true,
      runValidators: true,
    });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('PATCH /api/expenses/[id] failed:', err);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req, context) {
  const { user, error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  try {
    await connectDB();
    const id = await getId(context);
    const existing = await Expense.findById(id);
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await Expense.findByIdAndDelete(id);
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('DELETE /api/expenses/[id] failed:', err);
    return NextResponse.json({ error: err.message || 'Delete failed' }, { status: 500 });
  }
}