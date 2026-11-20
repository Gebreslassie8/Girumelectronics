// app/api/warranties/route.js
import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { Warranty } from '@/models';
import { requireAuth, requireRole } from '@/lib/auth';

export async function GET(req) {
  console.log('[warranties GET] === REQUEST RECEIVED ===');

  try {
    await connectDB();
    console.log('[warranties GET] DB connected');

    const auth = await requireAuth(req);
    console.log('[warranties GET] auth result:', JSON.stringify(auth, null, 2));

    if (!auth.ok) {
      console.log('[warranties GET] auth failed — returning error');
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: auth.status || 401 }
      );
    }

    const user = auth.user;
    console.log('[warranties GET] user:', {
      _id: user?._id,
      role: user?.role,
      phone: user?.phone,
      branch: user?.branch,
    });

    // Build query based on role
    const query = {};

    if (user.role === 'customer') {
      const norm = (p) => {
        if (!p) return '';
        let s = String(p).replace(/\s+/g, '').trim();
        if (s.startsWith('+251')) s = '0' + s.slice(4);
        if (s.startsWith('251'))  s = '0' + s.slice(3);
        return s;
      };
      const myPhone = norm(user.phone);
      query.$or = [
        { customerPhone: myPhone },
        { customerPhone: user.phone },
      ];
    } else if (user.role === 'seller') {
      if (user.branch) query.branch = user.branch;
    } else if (!['admin', 'owner', 'cashier', 'storekeeper'].includes(user.role)) {
      console.log('[warranties GET] forbidden role:', user.role);
      return NextResponse.json({ error: 'ፍቃድ የለዎትም' }, { status: 403 });
    }

    console.log('[warranties GET] final query:', JSON.stringify(query));

    const total = await Warranty.countDocuments({});
    const warranties = await Warranty.find(query)
      .populate('product', 'name category code')
      .populate('order', 'orderNumber customerName customerPhone itemType')
      .populate('branch', 'name code')
      .sort({ createdAt: -1 })
      .lean();

    console.log('[warranties GET] total in DB:', total);
    console.log('[warranties GET] returning:', warranties.length, 'warranties');
    console.log('[warranties GET] first item:', warranties[0] ? warranties[0].warrantyNumber : 'none');

    // ALWAYS return an array
    return NextResponse.json(Array.isArray(warranties) ? warranties : []);
  } catch (err) {
    console.error('[warranties GET] ERROR:', err);
    return NextResponse.json(
      { error: 'ስህተት ተፈጥሯል', detail: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const { error } = await requireRole(req, 'admin', 'owner', 'seller', 'cashier');
    if (error) return error;

    await connectDB();
    const body = await req.json().catch(() => ({}));
    console.log('[warranties POST] body:', JSON.stringify(body));

    const { order, product, itemType, customerName, customerPhone,
            startDate, endDate, durationMonths, status, branch, notes } = body || {};

    if (!customerName?.trim()) return NextResponse.json({ error: 'የደንበኛ ስም ያስፈልጋል' }, { status: 400 });
    if (!customerPhone?.trim()) return NextResponse.json({ error: 'የደንበኛ ስልክ ያስፈልጋል' }, { status: 400 });
    if (!itemType?.trim()) return NextResponse.json({ error: 'የዕቃ ዓይነት ያስፈልጋል' }, { status: 400 });
    if (!startDate) return NextResponse.json({ error: 'የጀመረበት ቀን ያስፈልጋል' }, { status: 400 });
    if (!branch) return NextResponse.json({ error: 'ቅርንጫፍ ያስፈልጋል' }, { status: 400 });

    const created = await Warranty.create({
      order: order || null,
      product: product || null,
      itemType: itemType.trim(),
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      durationMonths: Number(durationMonths) || 24,
      status: status || 'active',
      branch,
      notes: (notes || '').trim(),
    });

    console.log('[warranties POST] created:', created._id, created.warrantyNumber);

    const populated = await Warranty.findById(created._id)
      .populate('product', 'name category code')
      .populate('order', 'orderNumber')
      .populate('branch', 'name code')
      .lean();

    return NextResponse.json(populated, { status: 201 });
  } catch (err) {
    console.error('[warranties POST] ERROR:', err);
    return NextResponse.json({ error: err.message || 'ስህተት ተፈጥሯል' }, { status: 500 });
  }
}