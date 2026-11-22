import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { Employee, User } from '@/models';
import { requireAuth, requireRole } from '@/lib/auth';

const ALLOWED_STAFF_ROLES = ['admin', 'owner', 'seller', 'cashier', 'storekeeper'];

const POSITION_TO_ROLE = {
  'አስተዳዳሪ': 'admin',
  Admin: 'admin',
  'ባለቤት': 'owner',
  Owner: 'owner',
  'ሻጭ': 'seller',
  Seller: 'seller',
  'ገንዘብ ተቀባይ': 'cashier',
  Cashier: 'cashier',
  'መጋዘን ኃላፊ': 'storekeeper',
  'የመጋዘን ሰራተኛ': 'storekeeper',
  Storekeeper: 'storekeeper',
  'Store Keeper': 'storekeeper',
};

function resolveRoleFromInput(userRole, topRole, position, fallbackRole) {
  if (userRole && ALLOWED_STAFF_ROLES.includes(userRole)) return userRole;
  if (topRole && ALLOWED_STAFF_ROLES.includes(topRole)) return topRole;
  if (position) {
    const trimmed = String(position).trim();
    if (POSITION_TO_ROLE[trimmed]) return POSITION_TO_ROLE[trimmed];
    if (trimmed.includes('መጋዘን') || trimmed.toLowerCase().includes('store')) {
      return 'storekeeper';
    }
    if (trimmed.includes('ገንዘብ') || trimmed.toLowerCase().includes('cashier')) {
      return 'cashier';
    }
  }
  return fallbackRole || 'seller';
}

function isAdminUser(user) {
  return ['admin', 'owner'].includes(user?.role);
}

export async function GET(req, { params }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
  }

  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const employee = await Employee.findById(id)
    .populate('user', 'fullName phone email role branch isActive')
    .populate('branch', 'name code')
    .lean();

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const empUserId = String(employee.user?._id || employee.user || '');
  const currentUserId = String(user._id || user.id || '');
  if (!isAdminUser(user) && empUserId !== currentUserId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(employee);
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
  }

  const { error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();
    const { user: userPatch, ...empPatch } = body;

    const employee = await Employee.findById(id);
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    const empFields = [
      'position',
      'department',
      'salary',
      'status',
      'branch',
      'emergencyContact',
      'permissions',
    ];
    for (const k of empFields) {
      if (empPatch[k] !== undefined) {
        employee[k] = empPatch[k] === '' && k === 'branch' ? null : empPatch[k];
      }
    }
    if (empPatch.permissions !== undefined) {
      employee.markModified('permissions');
    }
    await employee.save();

    // Keep linked User document in sync (credentials, role, branch, active status)
    const userDoc = await User.findById(employee.user).select('+password');
    if (userDoc) {
      if (userPatch) {
        if (userPatch.fullName) userDoc.fullName = userPatch.fullName.trim();
        if (userPatch.phone) userDoc.phone = userPatch.phone.trim();
        if (userPatch.email !== undefined) {
          userDoc.email = userPatch.email ? userPatch.email.trim().toLowerCase() : undefined;
        }
        if (typeof userPatch.password === 'string' && userPatch.password.trim()) {
          userDoc.password = userPatch.password.trim();
        }
      }

      if (userPatch?.role || empPatch.role || empPatch.position) {
        userDoc.role = resolveRoleFromInput(
          userPatch?.role,
          empPatch.role,
          empPatch.position,
          userDoc.role
        );
      }

      if (empPatch.branch !== undefined) {
        userDoc.branch = empPatch.branch === '' ? null : empPatch.branch;
      }

      if (empPatch.status !== undefined) {
        userDoc.isActive = empPatch.status === 'active';
      }

      await userDoc.save();
    }

    await employee.populate('user', 'fullName phone email role branch isActive');
    await employee.populate('branch', 'name code');

    return NextResponse.json(employee);
  } catch (err) {
    if (err.code === 11000) {
      const dupField = Object.keys(err.keyPattern || {})[0];
      return NextResponse.json(
        { error: dupField ? `${dupField} already registered` : 'Already registered' },
        { status: 409 }
      );
    }
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
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid employee ID' }, { status: 400 });
  }

  const { error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  await connectDB();
  const employee = await Employee.findByIdAndDelete(id);
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }
  await User.findByIdAndDelete(employee.user);
  return NextResponse.json({ ok: true });
}