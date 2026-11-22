// import { NextResponse } from 'next/server';
// import connectDB from '@/lib/db';
// import { Product } from '@/models';
// import { requireAuth } from '@/lib/auth';

// export async function GET(req) {
//   const { user, error } = await requireAuth(req);
//   if (error) return error;

//   await connectDB();
//   const filter = ['admin', 'owner'].includes(user.role)
//     ? {}
//     : { branch: user.branch };
//   const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
//   return NextResponse.json(products);
// }

// export async function POST(req) {
//   const { user, error } = await requireAuth(req);
//   if (error) return error;

//   await connectDB();
//   const body = await req.json();
//   const product = await Product.create({
//     ...body,
//     branch: user.branch || body.branch,
//     createdBy: user._id,
//   });
//   return NextResponse.json(product, { status: 201 });
// }
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Product, Employee } from '@/models';
import { requireAuth } from '@/lib/auth';

const ALLOWED_STATUSES = ['in_stock', 'low_stock', 'out_of_stock', 'available', 'inactive'];

function isAdminUser(user) {
  return ['admin', 'owner'].includes(user?.role);
}

/**
 * Resolves the effective branch ObjectId string for a staff user,
 * checking User.branch first and falling back to Employee.branch.
 */
async function resolveUserBranchId(user) {
  const directBranch = user?.branch?._id || user?.branch;
  if (directBranch) return String(directBranch);

  const userId = user?._id || user?.id;
  if (!userId) return null;

  const emp = await Employee.findOne({ user: userId }).select('branch permissions').lean();
  return emp?.branch ? String(emp.branch) : null;
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const isPublic = searchParams.get('public') === 'true';

    await connectDB();

    // Public storefront catalog (used by HomePage without login)
    if (isPublic) {
      const publicProducts = await Product.find({ isActive: { $ne: false } })
        .select('name description sellingPrice category image')
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

      return NextResponse.json(publicProducts);
    }

    // Authenticated dashboard / inventory query
    const { user, error } = await requireAuth(req);
    if (error) return error;

    let filter = {};

    if (!isAdminUser(user)) {
      const emp = await Employee.findOne({ user: user._id || user.id })
        .select('branch permissions')
        .lean();
      const canViewAllBranches = Boolean(
        user?.permissions?.products?.allBranches || emp?.permissions?.products?.allBranches
      );

      if (!canViewAllBranches) {
        const branchId = (user?.branch?._id || user?.branch)
          ? String(user.branch._id || user.branch)
          : emp?.branch
          ? String(emp.branch)
          : null;

        // If non-admin has no assigned branch, show nothing rather than leaking other branches
        if (!branchId) {
          return NextResponse.json([]);
        }

        filter = { branch: branchId };
      }
    }

    const products = await Product.find(filter)
      .populate('branch', 'name code')
      .populate('createdBy', 'fullName phone')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(products);
  } catch (err) {
    console.error('[products:GET]', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const { user, error } = await requireAuth(req);
    if (error) return error;

    await connectDB();

    const admin = isAdminUser(user);
    const emp = admin
      ? null
      : await Employee.findOne({ user: user._id || user.id })
          .select('branch permissions')
          .lean();

    const canCreateProduct =
      admin ||
      ['seller', 'storekeeper'].includes(user.role) ||
      Boolean(user?.permissions?.products?.create || emp?.permissions?.products?.create);

    if (!canCreateProduct) {
      return NextResponse.json(
        { error: 'ዕቃ ለመጨመር ፈቃድ የለዎትም' },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Admin can pick any branch; non-admin is strictly locked to their assigned branch
    let targetBranch = null;
    if (admin) {
      targetBranch = body.branch && body.branch !== '' ? body.branch : null;
    } else {
      targetBranch = await resolveUserBranchId(user);
      if (!targetBranch) {
        return NextResponse.json(
          { error: 'ቅርንጫፍ ስላልተመደበልዎት ዕቃ መጨመር አይችሉም' },
          { status: 403 }
        );
      }
    }

    const payload = {
      ...body,
      branch: targetBranch,
      createdBy: user._id || user.id,
    };

    for (const numField of ['quantity', 'unitPrice', 'sellingPrice']) {
      if (payload[numField] !== undefined && payload[numField] !== '') {
        payload[numField] = Number(payload[numField]) || 0;
      }
    }

    if (
      payload.sellingPrice !== undefined &&
      payload.unitPrice !== undefined &&
      payload.sellingPrice < payload.unitPrice
    ) {
      return NextResponse.json(
        { error: 'የመሸጫ ዋጋ ከመግዣ ዋጋ መቀነስ አይችልም' },
        { status: 400 }
      );
    }

    if (payload.status) {
      const normalized = String(payload.status)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');
      if (ALLOWED_STATUSES.includes(normalized)) {
        payload.status = normalized;
      } else {
        delete payload.status;
      }
    }

    const created = await Product.create(payload);

    const product = await Product.findById(created._id)
      .populate('branch', 'name code')
      .populate('createdBy', 'fullName phone')
      .lean();

    return NextResponse.json(product, { status: 201 });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors)) errs[k] = err.errors[k].message;
      return NextResponse.json(
        { error: 'Validation failed', errors: errs },
        { status: 400 }
      );
    }
    if (err.code === 11000) {
      return NextResponse.json({ error: 'Duplicate code' }, { status: 409 });
    }
    console.error('[products:POST]', err);
    return NextResponse.json(
      { error: err.message || 'Create failed' },
      { status: 500 }
    );
  }
}