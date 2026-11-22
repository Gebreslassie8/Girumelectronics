import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { Order } from '@/models';
import { requireAuth } from '@/lib/auth';

const STAFF_ROLES = ['seller', 'cashier', 'storekeeper'];

function getUserBranchId(user) {
  if (!user?.branch) return null;
  return String(typeof user.branch === 'object' ? user.branch._id : user.branch);
}

function canAccessOrder(user, order) {
  if (!user || !order) return false;
  if (user.role === 'admin' || user.role === 'owner') return true;

  if (STAFF_ROLES.includes(user.role)) {
    const userBranch = getUserBranchId(user);
    const orderBranch = order.branch
      ? String(typeof order.branch === 'object' ? order.branch._id : order.branch)
      : null;
    if (userBranch && orderBranch) {
      return userBranch === orderBranch;
    }
    return true;
  }

  return false;
}

export async function GET(req, context) {
  const { error, user } = await requireAuth(req);
  if (error) return error;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
  }

  await connectDB();
  const order = await Order.findById(id)
    .populate('branch', 'name code')
    .populate('product', 'name code')
    .populate('createdBy', 'fullName phone')
    .lean();

  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  if (!canAccessOrder(user, order)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return NextResponse.json(order);
}

export async function PATCH(req, context) {
  const { error, user } = await requireAuth(req);
  if (error) return error;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
  }

  try {
    await connectDB();
    const existing = await Order.findById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!canAccessOrder(user, existing)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();

    const qty = body.quantity !== undefined ? Number(body.quantity) : existing.quantity;
    const unitPrice = body.unitPrice !== undefined ? Number(body.unitPrice) : existing.unitPrice;
    const totalPrice =
      body.totalPrice !== undefined ? Number(body.totalPrice) : (Number(qty) || 1) * (Number(unitPrice) || 0);
    const prepayment =
      body.prepayment !== undefined ? Number(body.prepayment) : existing.prepayment;
    const remainingPayment =
      body.remainingPayment !== undefined
        ? Number(body.remainingPayment)
        : Math.max(totalPrice - (Number(prepayment) || 0), 0);

    if (body.customerName !== undefined) existing.customerName = String(body.customerName).trim();
    if (body.customerPhone !== undefined) existing.customerPhone = String(body.customerPhone).trim();
    if (body.address !== undefined) existing.address = String(body.address).trim();
    if (body.itemType !== undefined) existing.itemType = body.itemType;
    if (body.quantity !== undefined) existing.quantity = Number(qty) || 1;
    if (body.unitPrice !== undefined) existing.unitPrice = Number(unitPrice) || 0;
    existing.totalPrice = totalPrice;
    existing.prepayment = Number(prepayment) || 0;
    existing.remainingPayment = remainingPayment;
    if (body.status !== undefined) existing.status = body.status;
    if (body.orderDate !== undefined && body.orderDate) {
      const parsedOrderDate = new Date(body.orderDate);
      if (!isNaN(parsedOrderDate.getTime())) existing.orderDate = parsedOrderDate;
    }
    if (body.appointmentDate !== undefined && body.appointmentDate) {
      const parsedAppointment = new Date(body.appointmentDate);
      if (!isNaN(parsedAppointment.getTime())) existing.appointmentDate = parsedAppointment;
    }
    if (body.note !== undefined) existing.note = body.note || undefined;
    if (body.measurements !== undefined) existing.measurements = body.measurements || {};

    // Keep staff locked to their own branch unless admin/owner specifies another
    if (body.branch !== undefined && (user.role === 'admin' || user.role === 'owner')) {
      existing.branch = body.branch || existing.branch;
    }

    await existing.save();
    await existing.populate('branch', 'name code');
    await existing.populate('createdBy', 'fullName phone');

    return NextResponse.json(existing);
  } catch (err) {
    console.error('[orders:PATCH]', err);
    return NextResponse.json({ error: err.message || 'Update failed' }, { status: 500 });
  }
}

export async function DELETE(req, context) {
  const { error, user } = await requireAuth(req);
  if (error) return error;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
  }

  try {
    await connectDB();
    const order = await Order.findById(id);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (!canAccessOrder(user, order)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await order.deleteOne();
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('[orders:DELETE]', err);
    return NextResponse.json({ error: err.message || 'Delete failed' }, { status: 500 });
  }
}