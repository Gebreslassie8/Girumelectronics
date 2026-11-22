import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { Receipt, Order, Employee, Branch, nextCode } from '@/models';
import { requireAuth, requireRole } from '@/lib/auth';

const STAFF_ROLES = ['seller', 'cashier', 'storekeeper'];
const VALID_RECEIPT_STATUSES = ['active', 'completed', 'cancelled', 'pending', 'draft'];

function normalizeId(val) {
  if (!val) return null;
  if (typeof val === 'object') {
    return val._id ? String(val._id) : val.id ? String(val.id) : null;
  }
  return String(val);
}

function normalizeReceiptStatus(rawStatus) {
  if (!rawStatus) return 'active';
  const raw = String(rawStatus).trim();
  const lower = raw.toLowerCase();

  if (lower === 'paid') return 'completed';
  if (raw === 'ረቂቅ' || lower === 'draft') return 'draft';
  if (VALID_RECEIPT_STATUSES.includes(lower)) return lower;
  return 'active';
}

async function resolveBranchId(user, requestedBranch) {
  const explicit = normalizeId(requestedBranch);
  if (explicit) {
    if (mongoose.Types.ObjectId.isValid(explicit)) {
      return explicit;
    }
    if (Branch) {
      const escaped = explicit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const foundBranch = await Branch.findOne({
        name: new RegExp(`^${escaped}$`, 'i'),
      })
        .select('_id')
        .lean();
      if (foundBranch?._id) return String(foundBranch._id);
    }
  }

  const fromUser = normalizeId(user?.branch);
  if (fromUser && mongoose.Types.ObjectId.isValid(fromUser)) {
    return fromUser;
  }

  const userId = normalizeId(user?._id || user?.id);
  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    const emp = await Employee.findOne({ user: userId }).select('branch').lean();
    const fromEmp = normalizeId(emp?.branch);
    if (fromEmp && mongoose.Types.ObjectId.isValid(fromEmp)) {
      return fromEmp;
    }
  }

  return null;
}

export async function GET(req) {
  try {
    const { error } = await requireAuth(req);
    if (error) return error;

    await connectDB();
    const receipts = await Receipt.find({})
      .populate('branch', 'name code')
      .populate('order', 'orderNumber customerName status')
      .populate('issuedBy', 'fullName phone')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(receipts);
  } catch (err) {
    console.error('[receipts:GET]', err);
    return NextResponse.json(
      { error: err.message || 'Failed to load receipts' },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  const { error, user } = await requireRole(
    req,
    'admin',
    'owner',
    'seller',
    'cashier',
    'storekeeper'
  );
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();

    const customerName = String(body.customerName || '').trim();
    const customerPhone = body.customerPhone ? String(body.customerPhone).trim() : undefined;
    const itemType = String(body.itemType || '').trim();
    const productCode = body.productCode ? String(body.productCode).trim() : undefined;
    const orderNumberInput = body.orderNumber ? String(body.orderNumber).trim() : '';

    if (!customerName || !itemType) {
      return NextResponse.json(
        { error: 'የደንበኛ ስም እና የዕቃ ዓይነት ያስፈልጋሉ' },
        { status: 400 }
      );
    }

    const totalPrice = Number(body.totalPrice) || 0;
    const prepayment = Number(body.prepayment) || 0;
    if (prepayment > totalPrice) {
      return NextResponse.json(
        { error: 'ቅድመ ክፍያ ከጠቅላላ ዋጋ መብለጥ አይችልም' },
        { status: 400 }
      );
    }
    const remainingPayment =
      body.remainingPayment !== undefined
        ? Math.max(Number(body.remainingPayment) || 0, 0)
        : Math.max(totalPrice - prepayment, 0);

    const parsedOrderDate = body.orderDate ? new Date(body.orderDate) : new Date();
    if (isNaN(parsedOrderDate.getTime())) {
      return NextResponse.json({ error: 'Invalid orderDate' }, { status: 400 });
    }

    let parsedAppointment = null;
    if (body.appointmentDate) {
      const d = new Date(body.appointmentDate);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'Invalid appointmentDate' }, { status: 400 });
      }
      parsedAppointment = d;
    }

    let linkedOrderId = undefined;
    let linkedOrderBranch = null;
    if (body.order && mongoose.Types.ObjectId.isValid(String(body.order))) {
      linkedOrderId = body.order;
    } else if (orderNumberInput) {
      const foundOrder = await Order.findOne({ orderNumber: orderNumberInput })
        .select('_id branch')
        .lean();
      if (foundOrder) {
        linkedOrderId = foundOrder._id;
        linkedOrderBranch = normalizeId(foundOrder.branch);
      }
    }

    const isAdmin = ['admin', 'owner'].includes(user?.role);
    const resolvedBranch = isAdmin
      ? normalizeId(body.branch) || linkedOrderBranch || (await resolveBranchId(user, null))
      : (await resolveBranchId(user, body.branch)) || linkedOrderBranch;

    if (!isAdmin && STAFF_ROLES.includes(user?.role) && !resolvedBranch) {
      return NextResponse.json(
        { error: 'ቅርንጫፍ አልተመደበም (Branch is required)' },
        { status: 400 }
      );
    }

    const actorId = normalizeId(user?._id || user?.id);
    const validActorId =
      actorId && mongoose.Types.ObjectId.isValid(actorId) ? actorId : undefined;

    if (!validActorId) {
      return NextResponse.json(
        { error: 'Authenticated user ID is missing' },
        { status: 401 }
      );
    }

    const status = normalizeReceiptStatus(body.status);

    let created = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const receiptNumber =
        typeof nextCode === 'function'
          ? await nextCode('RCP', 'receipt')
          : `RCP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      try {
        created = await Receipt.create({
          receiptNumber,
          order: linkedOrderId,
          orderNumber: orderNumberInput || undefined,
          productCode,
          itemType,
          customerName,
          customerPhone,
          totalPrice,
          prepayment,
          remainingPayment,
          status,
          orderDate: parsedOrderDate,
          appointmentDate: parsedAppointment || undefined,
          note: body.note || undefined,
          branch: resolvedBranch || undefined,
          issuedBy: validActorId,
        });
        break;
      } catch (createErr) {
        if (createErr?.code === 11000 && attempt < 2) {
          continue;
        }
        throw createErr;
      }
    }

    await created.populate('branch', 'name code');
    await created.populate('order', 'orderNumber customerName status');
    await created.populate('issuedBy', 'fullName phone');

    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors || {})) {
        errs[k] = err.errors[k].message;
      }
      return NextResponse.json(
        { error: 'Validation failed', errors: errs },
        { status: 400 }
      );
    }
    if (err.code === 11000) {
      return NextResponse.json(
        { error: 'Duplicate receipt number' },
        { status: 409 }
      );
    }
    console.error('[receipts:POST]', err);
    return NextResponse.json(
      { error: err.message || 'Create failed' },
      { status: 500 }
    );
  }
}