import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Expense } from '@/models';
import { requireRole } from '@/lib/auth';

export async function GET(req) {
  const { user, error } = await requireRole(req, 'admin', 'owner', 'seller');
  if (error) return error;

  await connectDB();
  const filter = ['admin', 'owner'].includes(user.role) ? {} : { branch: user.branch };
  const expenses = await Expense.find(filter)
    .sort({ expenseDate: -1 })
    .populate('branch', 'name')
    .populate('recordedBy', 'fullName')
    .lean();
  return NextResponse.json(expenses);
}

export async function POST(req) {
  const { user, error } = await requireRole(req, 'admin', 'owner', 'seller');
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();

    if (!body.paidTo || !String(body.paidTo).trim())
      return NextResponse.json({ error: 'paidTo is required' }, { status: 400 });
    if (!body.category)
      return NextResponse.json({ error: 'category is required' }, { status: 400 });
    if (body.amount == null || isNaN(Number(body.amount)))
      return NextResponse.json({ error: 'amount is required' }, { status: 400 });

    const branch = ['admin', 'owner'].includes(user.role)
      ? (body.branch || user.branch)
      : user.branch;

    if (!branch)
      return NextResponse.json({ error: 'branch is required' }, { status: 400 });

    const cleanDescription =
      body.description != null ? String(body.description).trim() : '';

    const doc = await Expense.create({
      category:      body.category,
      description:   cleanDescription || undefined,
      paidTo:        String(body.paidTo).trim(),
      amount:        Number(body.amount),
      paymentMethod: body.paymentMethod || 'cash',
      reference:     body.reference || undefined,
      expenseDate:   body.expenseDate ? new Date(body.expenseDate) : new Date(),
      branch,
      recordedBy:    user._id,
    });

    return NextResponse.json(doc, { status: 201 });
  } catch (err) {
    console.error('POST /api/expenses failed:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to create expense' },
      { status: 500 }
    );
  }
}