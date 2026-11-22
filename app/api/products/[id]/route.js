import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { Product, Employee } from '@/models';
import { requireAuth } from '@/lib/auth';

function isAdminUser(user) {
  return ['admin', 'owner'].includes(user?.role);
}

async function getStaffContext(user) {
  const emp = await Employee.findOne({ user: user._id || user.id })
    .select('branch permissions')
    .lean();

  const branchId = (user?.branch?._id || user?.branch)
    ? String(user.branch._id || user.branch)
    : emp?.branch
    ? String(emp.branch)
    : null;

  const perms = {
    ...(emp?.permissions?.products || {}),
    ...(user?.permissions?.products || {}),
  };

  return { branchId, perms };
}

export async function GET(req, { params }) {
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
  }

  const { user, error } = await requireAuth(req);
  if (error) return error;

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
    const productBranchId = product.branch?._id
      ? String(product.branch._id)
      : product.branch
      ? String(product.branch)
      : null;

    if (!perms.allBranches && (!branchId || productBranchId !== branchId)) {
      return NextResponse.json(
        { error: 'ይህንን ዕቃ ከተመደቡበት ቅርንጫፍ ውጭ ማየት አይችሉም' },
        { status: 403 }
      );
    }
  }

  return NextResponse.json(product);
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
        ['seller', 'storekeeper'].includes(user.role) || Boolean(perms.update || perms.edit);

      if (!canEdit) {
        return NextResponse.json({ error: 'ዕቃ ለማስተካከል ፈቃድ የለዎትም' }, { status: 403 });
      }

      const productBranchId = product.branch ? String(product.branch) : null;
      if (!perms.allBranches && (!branchId || productBranchId !== branchId)) {
        return NextResponse.json(
          { error: 'ከተመደቡበት ቅርንጫፍ ውጭ ያለ ዕቃ ማስተካከል አይችሉም' },
          { status: 403 }
        );
      }
    }

    // Only admin/owner can reassign a product to a different branch
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

  await connectDB();
  const product = await Product.findById(id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const admin = isAdminUser(user);
  if (!admin) {
    const { branchId, perms } = await getStaffContext(user);
    const productBranchId = product.branch ? String(product.branch) : null;
    const canDeleteOwnBranch =
      Boolean(perms.delete) && branchId && productBranchId === branchId;

    if (!canDeleteOwnBranch) {
      return NextResponse.json(
        { error: 'ይህንን ዕቃ ለመሰረዝ ፈቃድ የለዎትም' },
        { status: 403 }
      );
    }
  }

  await product.deleteOne();
  return NextResponse.json({ ok: true });
}