import { NextResponse } from 'next/server';
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

function resolveRoleFromInput(userRole, topRole, position) {
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
  return 'seller';
}

function isAdminUser(user) {
  return ['admin', 'owner'].includes(user?.role);
}

export async function GET(req) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();

  // Admins/owners see all employees; non-admins see only their own record
  const filter = isAdminUser(user) ? {} : { user: user._id || user.id };

  const employees = await Employee.find(filter)
    .populate('user', 'fullName phone email role branch isActive')
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
    const {
      user,
      password: topPassword,
      role: topRole,
      position,
      department,
      salary,
      status,
      branch,
      emergencyContact,
      permissions,
    } = body;

    const rawPassword =
      typeof user?.password === 'string' && user.password.trim()
        ? user.password.trim()
        : typeof topPassword === 'string' && topPassword.trim()
        ? topPassword.trim()
        : '';

    if (!user?.fullName || !user?.phone || !rawPassword || !position || salary == null) {
      return NextResponse.json(
        { error: 'Missing required fields (including password)' },
        { status: 400 }
      );
    }

    const cleanPhone = user.phone.trim();
    const cleanEmail = user.email ? user.email.trim().toLowerCase() : undefined;
    const cleanBranch = branch && branch !== '' ? branch : null;
    const assignedRole = resolveRoleFromInput(user?.role, topRole, position);

    const existingUser = await User.findOne({
      $or: [
        { phone: cleanPhone },
        ...(cleanEmail ? [{ email: cleanEmail }] : []),
      ],
    }).lean();

    if (existingUser) {
      const isEmailMatch = cleanEmail && existingUser.email === cleanEmail;
      return NextResponse.json(
        {
          error: isEmailMatch
            ? 'Email already registered'
            : 'Phone number already registered',
        },
        { status: 409 }
      );
    }

    const newUser = await User.create({
      fullName: user.fullName.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      password: rawPassword,
      role: assignedRole,
      branch: cleanBranch,
      isActive: (status || 'active') === 'active',
    });

    const employee = await Employee.create({
      user: newUser._id,
      position,
      department,
      salary,
      status: status || 'active',
      branch: cleanBranch,
      emergencyContact,
      permissions: permissions || {},
    });

    await employee.populate('user', 'fullName phone email role branch isActive');
    await employee.populate('branch', 'name code');

    return NextResponse.json(employee, { status: 201 });
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
    console.error('[employees:POST]', err);
    return NextResponse.json({ error: err.message || 'Create failed' }, { status: 500 });
  }
}