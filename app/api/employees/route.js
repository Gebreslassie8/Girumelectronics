import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Employee, User } from '@/models';
import { requireAuth, requireRole } from '@/lib/auth';

export async function GET(req) {
  const { error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const employees = await Employee.find({})
    .populate('user', 'fullName phone email role')
    .populate('branch', 'name code')
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json(employees);
}

export async function POST(req) {
  const { error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();
    const { user, position, department, salary, status, branch, emergencyContact, permissions } = body;

    if (!user?.fullName || !user?.phone || !position || salary == null) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const phoneExists = await User.findOne({ phone: user.phone }).lean();
    if (phoneExists) {
      return NextResponse.json(
        { error: 'Phone number already registered' },
        { status: 409 }
      );
    }

    const newUser = await User.create({
      fullName: user.fullName.trim(),
      phone: user.phone.trim(),
      email: user.email?.toLowerCase() || undefined,
      password: 'welcome123',
      role: 'seller',
      branch: branch || null,
      isActive: true,
    });

    const employee = await Employee.create({
      user: newUser._id,
      position,
      department,
      salary,
      status: status || 'active',
      branch: branch || null,
      emergencyContact,
      permissions,
    });

    await employee.populate('user', 'fullName phone email role');
    await employee.populate('branch', 'name code');

    return NextResponse.json(employee, { status: 201 });
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json({ error: 'Already registered' }, { status: 409 });
    }
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors)) errs[k] = err.errors[k].message;
      return NextResponse.json({ error: 'Validation failed', errors: errs }, { status: 400 });
    }
    console.error('[employees:POST]', err);
    return NextResponse.json({ error: err.message || 'Create failed' }, { status: 500 });
  }
}