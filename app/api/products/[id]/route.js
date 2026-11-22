import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { Product, Employee } from '@/models';
import { requireAuth } from '@/lib/auth';

const ADMIN_ROLES = ['admin', 'owner'];
const STAFF_ROLES = ['seller', 'cashier', 'storekeeper'];

function isAdminUser(user) {
  return ADMIN_ROLES.includes(user?.role);
}

function normalizeId(val) {
  if (!val) return null;
  return String(typeof val === 'object' ? val._id || val.id || '' : val) || null;
}

async function getStaffContext(user) {
  const userId = user?._id || user?.id;
  const emp = userId
    ? await Employee.findOne({ user: userId }).select('branch permissions').lean()
    : null;

  const branchId = normalizeId(user?.branch) || normalizeId(emp?.branch);

  const perms = {
    ...(emp?.permissions?.products || {}),
    ...(user?.permissions?.products || {}),
  };

  return { branchId, perms };
}

function hasBranchAccess(userBranchId, targetBranchId, perms, allowUnassignedLegacy = false) {
  if (perms?.allBranches) return true;
  if (!userBranchId) return false;
  if (!targetBranchId) return allowUnassignedLegacy;
  return userBranchId === targetBranchId;
}

export async function GET(req, { params }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  }

  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    await connectDB();
    const product = await Product.findById(id)
      .populate('branch', 'name code')
      .populate('createdBy', 'fullName phone')
      .lean();

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    if (!isAdminUser(user)) {
      const { branchId, perms } = await getStaffContext(user);
      const productBranchId = normalizeId(product.branch);

      if (!hasBranchAccess(branchId, productBranchId, perms, true)) {
        return NextResponse.json(
          { error: 'ይህንን ዕቃ ከተመደቡበት ቅርንጫፍ ውጭ ማየት አይችሉም' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(product);
  } catch (err) {
    console.error('[products:GET]', err);
    return NextResponse.json({ error: err.message || 'Fetch failed' }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  }

  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();

    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const admin = isAdminUser(user);

    if (!admin) {
      const { branchId, perms } = await getStaffContext(user);
      const canEdit =
        STAFF_ROLES.includes(user.role) || Boolean(perms.update || perms.edit);

      if (!canEdit) {
        return NextResponse.json({ error: 'ዕቃ ለማስተካከል ፈቃድ የለዎትም' }, { status: 403 });
      }

      const productBranchId = normalizeId(product.branch);
      if (!hasBranchAccess(branchId, productBranchId, perms, true)) {
        return NextResponse.json(
          { error: 'ከተመደቡበት ቅርንጫፍ ውጭ ያለ ዕቃ ማስተካከል አይችሉም' },
          { status: 403 }
        );
      }
    }

    const allowed = admin
      ? [
          'name', 'category', 'description', 'quantity', 'unit',
          'unitPrice', 'sellingPrice', 'status', 'branch', 'image',
        ]
      : [
          'name', 'category', 'description', 'quantity', 'unit',
          'unitPrice', 'sellingPrice', 'status', 'image',
        ];

    for (const k of allowed) {
      if (body[k] !== undefined) {
        if (k === 'branch' && body[k] === '') {
          product[k] = null;
        } else if (['quantity', 'unitPrice', 'sellingPrice'].includes(k)) {
          product[k] = Number(body[k]) || 0;
        } else {
          product[k] = body[k];
        }
      }
    }

    if (product.sellingPrice < product.unitPrice) {
      return NextResponse.json(
        { error: 'የመሸጫ ዋጋ ከመግዣ ዋጋ መቀነስ አይችልም' },
        { status: 400 }
      );
    }

    await product.save();
    await product.populate('branch', 'name code');
    await product.populate('createdBy', 'fullName phone');

    return NextResponse.json(product);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors)) errs[k] = err.errors[k].message;
      return NextResponse.json({ error: 'Validation failed', errors: errs }, { status: 400 });
    }
    if (err.code === 11000) {
      return NextResponse.json({ error: 'Duplicate code' }, { status: 409 });
    }
    console.error('[products:PATCH]', err);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  }

  const { user, error } = await requireAuth(req);
  if (error) return error;

  try {
    await connectDB();
    const product = await Product.findById(id);
    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const admin = isAdminUser(user);
    if (!admin) {
      const { branchId, perms } = await getStaffContext(user);
      const canDeleteRole =
        STAFF_ROLES.includes(user.role) || Boolean(perms.delete);

      if (!canDeleteRole) {
        return NextResponse.json(
          { error: 'ይህንን ዕቃ ለመሰረዝ ፈቃድ የለዎትም' },
          { status: 403 }
        );
      }

      const productBranchId = normalizeId(product.branch);
      if (!hasBranchAccess(branchId, productBranchId, perms, true)) {
        return NextResponse.json(
          { error: 'ከተመደቡበት ቅርንጫፍ ውጭ ያለ ዕቃ መሰረዝ አይችሉም' },
          { status: 403 }
        );
      }
    }

    await product.deleteOne();
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('[products:DELETE]', err);
    return NextResponse.json({ error: err.message || 'Delete failed' }, { status: 500 });
  }
}