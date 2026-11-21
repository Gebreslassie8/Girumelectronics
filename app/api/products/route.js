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
import { Product } from '@/models';
import { requireAuth } from '@/lib/auth';

const ALLOWED_STATUSES = ['in_stock', 'low_stock', 'out_of_stock', 'available', 'inactive'];

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

    const filter = ['admin', 'owner'].includes(user.role)
      ? {}
      : { branch: user.branch };

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
    const body = await req.json();

    const payload = {
      ...body,
      branch: user.branch || body.branch || null,
      createdBy: user._id,
    };

    if (payload.branch === '') {
      payload.branch = null;
    }

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