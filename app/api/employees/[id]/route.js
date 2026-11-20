import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Employee, User } from '@/models';
import { requireAuth, requireRole } from '@/lib/auth';

export async function GET(req, { params }) {
  const { id } = await params;
  const { error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const employee = await Employee.findById(id)
    .populate('user', 'fullName phone email role')
    .populate('branch', 'name code')
    .lean();
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  return NextResponse.json(employee);
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  const { error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();
    const { user: userPatch, ...empPatch } = body;

    const employee = await Employee.findById(id);
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    if (userPatch) {
      const userUpdate = {};
      if (userPatch.fullName) userUpdate.fullName = userPatch.fullName;
      if (userPatch.phone) userUpdate.phone = userPatch.phone;
      if (userPatch.email !== undefined) userUpdate.email = userPatch.email || undefined;
      if (Object.keys(userUpdate).length > 0) {
        await User.findByIdAndUpdate(employee.user, userUpdate, { runValidators: true });
      }
    }

    const empFields = ['position', 'department', 'salary', 'status', 'branch', 'emergencyContact', 'permissions'];
    for (const k of empFields) {
      if (empPatch[k] !== undefined) {
        employee[k] = empPatch[k] === '' && k === 'branch' ? null : empPatch[k];
      }
    }
    await employee.save();

    await employee.populate('user', 'fullName phone email role');
    await employee.populate('branch', 'name code');

    return NextResponse.json(employee);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors)) errs[k] = err.errors[k].message;
      return NextResponse.json({ error: 'Validation failed', errors: errs }, { status: 400 });
    }
    console.error('[employees:PATCH]', err);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  const { error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  await connectDB();
  const employee = await Employee.findByIdAndDelete(id);
  if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  await User.findByIdAndDelete(employee.user);
  return NextResponse.json({ ok: true });
}