import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Branch } from '@/models';
import { requireAuth, requireRole } from '@/lib/auth';

export async function GET(req, { params }) {
  const { id } = await params;

  const { error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const branch = await Branch.findById(id)
    .populate('manager', 'fullName phone email role')
    .lean();
  if (!branch) {
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
  }
  return NextResponse.json(branch);
}

export async function PATCH(req, { params }) {
  const { id } = await params;

  const { error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();

    const patch = {};
    for (const k of ['name', 'address', 'phone', 'code', 'manager', 'isActive']) {
      if (body[k] !== undefined) {
        if (k === 'manager' && body[k] === '') patch[k] = null;
        else patch[k] = body[k];
      }
    }

    const branch = await Branch.findByIdAndUpdate(id, patch, {
      returnDocument: 'after',
      runValidators: true,
    })
      .populate('manager', 'fullName phone email role')
      .lean();

    if (!branch) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }
    return NextResponse.json(branch);
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json({ error: 'Code already exists' }, { status: 409 });
    }
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors)) errs[k] = err.errors[k].message;
      return NextResponse.json({ error: 'Validation failed', errors: errs }, { status: 400 });
    }
    console.error('[branches:PATCH]', err);
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;

  const { error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  await connectDB();
  const branch = await Branch.findByIdAndDelete(id);
  if (!branch) {
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}