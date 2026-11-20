import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Order, nextCode } from '@/models';
import { requireAuth, requireRole } from '@/lib/auth';

export async function GET(req) {
  const { error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const orders = await Order.find({})
    .populate('branch', 'name code')
    .populate('product', 'name code')
    .populate('createdBy', 'fullName phone')
    .sort({ createdAt: -1 })
    .lean();
  return NextResponse.json(orders);
}

export async function POST(req) {
  const { error, user } = await requireRole(req, 'admin', 'owner', 'seller');
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();
    const customerName = body.customerName;
    const customerPhone = body.customerPhone;
    const address = body.address;
    const itemType = body.itemType;
    const quantity = body.quantity;
    const unitPrice = body.unitPrice;
    const prepayment = body.prepayment;
    const status = body.status;
    const orderDate = body.orderDate;
    const appointmentDate = body.appointmentDate;
    const note = body.note;
    const branch = body.branch;
    const measurements = body.measurements;

    if (!customerName || !customerPhone || !itemType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    let resolvedBranch = branch;
    if (!resolvedBranch && user.branch) {
      resolvedBranch = typeof user.branch === 'object' ? user.branch._id : user.branch;
    }
    if (!resolvedBranch) {
      return NextResponse.json({ error: 'Branch is required' }, { status: 400 });
    }

    const parsedAppointment = new Date(appointmentDate);
    if (isNaN(parsedAppointment.getTime())) {
      return NextResponse.json({ error: 'Invalid appointmentDate' }, { status: 400 });
    }

    const parsedOrderDate = orderDate ? new Date(orderDate) : new Date();

    const qty = Number(quantity) || 1;
    const price = Number(unitPrice) || 0;
    const totalPrice = qty * price;
    const prepay = Number(prepayment) || 0;
    const remainingPayment = Math.max(totalPrice - prepay, 0);

    const orderNumber = await nextCode('ORD', 'order');

    const order = await Order.create({
      orderNumber,
      customerName: String(customerName).trim(),
      customerPhone: String(customerPhone).trim(),
      address: String(address).trim(),
      itemType,
      quantity: qty,
      unitPrice: price,
      totalPrice,
      prepayment: prepay,
      remainingPayment,
      status: status || 'pending',
      orderDate: parsedOrderDate,
      appointmentDate: parsedAppointment,
      note: note || undefined,
      branch: resolvedBranch,
      measurements: measurements || {},
      createdBy: user._id,
    });

    await order.populate('branch', 'name code');
    await order.populate('createdBy', 'fullName phone');

    return NextResponse.json(order, { status: 201 });
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors)) errs[k] = err.errors[k].message;
      return NextResponse.json({ error: 'Validation failed', errors: errs }, { status: 400 });
    }
    if (err.code === 11000) {
      try {
        const retryNumber = await nextCode('ORD', 'order');
        const parsedAppointment2 = new Date(appointmentDate);
        const parsedOrderDate2 = orderDate ? new Date(orderDate) : new Date();
        const qty2 = Number(quantity) || 1;
        const price2 = Number(unitPrice) || 0;
        const total2 = qty2 * price2;
        const pre2 = Number(prepayment) || 0;
        const remain2 = Math.max(total2 - pre2, 0);
        const retry = await Order.create({
          orderNumber: retryNumber,
          customerName: String(customerName).trim(),
          customerPhone: String(customerPhone).trim(),
          address: String(address).trim(),
          itemType,
          quantity: qty2,
          unitPrice: price2,
          totalPrice: total2,
          prepayment: pre2,
          remainingPayment: remain2,
          status: status || 'pending',
          orderDate: parsedOrderDate2,
          appointmentDate: parsedAppointment2,
          note: note || undefined,
          branch: resolvedBranch,
          measurements: measurements || {},
          createdBy: user._id,
        });
        return NextResponse.json(retry, { status: 201 });
      } catch (e) {
        return NextResponse.json({ error: 'Duplicate order number' }, { status: 409 });
      }
    }
    console.error('[orders:POST]', err);
    return NextResponse.json({ error: err.message || 'Create failed' }, { status: 500 });
  }
}