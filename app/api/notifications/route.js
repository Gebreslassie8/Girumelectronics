import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Notification, User, Order, Branch, Revenue, Product } from '@/models';
import { requireAuth } from '@/lib/auth';

function makeFingerprint({ relatedId, title, message }) {
  if (relatedId) return `id:${String(relatedId)}`;
  return `msg:${(title || '').trim()}|${(message || '').trim()}`;
}

export async function GET(req) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();

  const userId = user._id || user.id;
  const role = (user.role || 'customer').toLowerCase();
  const isAdmin = role === 'admin' || role === 'owner';

  // 1. Load ALL existing Notification records for this user (no 100-doc cutoff so old items aren't re-added)
  const existingUserNotifs = await Notification.find({ recipient: userId })
    .select('relatedId title message isRead')
    .lean();

  const seenFingerprints = new Set();
  for (const n of existingUserNotifs) {
    if (n.relatedId) seenFingerprints.add(`id:${String(n.relatedId)}`);
    seenFingerprints.add(`msg:${(n.title || '').trim()}|${(n.message || '').trim()}`);
  }

  const candidates = [];
  const pushUnique = (doc) => {
    const idKey = doc.relatedId ? `id:${String(doc.relatedId)}` : null;
    const msgKey = `msg:${(doc.title || '').trim()}|${(doc.message || '').trim()}`;
    if ((idKey && seenFingerprints.has(idKey)) || seenFingerprints.has(msgKey)) {
      return;
    }
    if (idKey) seenFingerprints.add(idKey);
    seenFingerprints.add(msgKey);
    candidates.push(doc);
  };

  // 2. Orders
  const orderFilter =
    role === 'customer'
      ? { customerPhone: user.phone }
      : role === 'seller' && user.branch
      ? { branch: user.branch }
      : {};

  const orders = await Order.find(orderFilter).sort({ createdAt: -1 }).limit(5).lean();
  for (const o of orders) {
    pushUnique({
      title: `ትዕዛዝ #${o.orderNumber || o._id.toString().slice(-6).toUpperCase()}`,
      message: `${o.customerName} — ${o.quantity}x ${o.itemType} (${Number(o.totalPrice || 0).toLocaleString()} ብር)`,
      type: 'order',
      severity: o.status === 'pending' ? 'warning' : 'info',
      isRead: false,
      recipient: userId,
      branch: o.branch || null,
      relatedModel: 'Order',
      relatedId: o._id,
      link: '/dashboard/orders',
      createdAt: o.createdAt || new Date(),
    });
  }

  // 3. Low Stock
  if (isAdmin || role === 'seller') {
    const stockFilter = { quantity: { $lte: 5 } };
    if (role === 'seller' && user.branch) stockFilter.branch = user.branch;

    const lowStock = await Product.find(stockFilter).sort({ updatedAt: -1 }).limit(5).lean();
    for (const p of lowStock) {
      pushUnique({
        title: 'የዕቃ ክምችት አነስተኛ ሆኗል',
        message: `"${p.name}" ክምችት ${p.quantity} ${p.unit || 'pcs'} ቀርቷል።`,
        type: 'stock',
        severity: 'warning',
        isRead: false,
        recipient: userId,
        branch: p.branch || null,
        relatedModel: 'Product',
        relatedId: p._id,
        link: '/dashboard/inventory',
        createdAt: p.updatedAt || p.createdAt || new Date(),
      });
    }
  }

  // 4. Admin feeds (Users, Branches, Revenues)
  if (isAdmin) {
    const [recentUsers, recentBranches, recentRevenues] = await Promise.all([
      User.find({}).sort({ createdAt: -1 }).limit(3).lean(),
      Branch.find({}).sort({ createdAt: -1 }).limit(3).lean(),
      Revenue.find({}).sort({ createdAt: -1 }).limit(3).lean(),
    ]);

    for (const u of recentUsers) {
      pushUnique({
        title: 'የተመዘገበ ተጠቃሚ',
        message: `${u.fullName} (${u.role}) — ${u.phone}`,
        type: 'other',
        severity: 'info',
        isRead: false,
        recipient: userId,
        branch: u.branch || null,
        relatedId: u._id,
        link: '/dashboard/users',
        createdAt: u.createdAt || new Date(),
      });
    }

    for (const b of recentBranches) {
      pushUnique({
        title: 'ቅርንጫፍ',
        message: `ቅርንጫፍ "${b.name}" (${b.address})`,
        type: 'other',
        severity: 'info',
        isRead: false,
        recipient: userId,
        branch: b._id,
        relatedId: b._id,
        link: '/dashboard/branches',
        createdAt: b.createdAt || new Date(),
      });
    }

    for (const r of recentRevenues) {
      pushUnique({
        title: 'የተመዘገበ ገቢ',
        message: `${r.description} — ${Number(r.amount || 0).toLocaleString()} ብር`,
        type: 'payment',
        severity: 'success',
        isRead: false,
        recipient: userId,
        branch: r.branch || null,
        relatedModel: 'Revenue',
        relatedId: r._id,
        link: '/dashboard/analytics',
        createdAt: r.revenueDate || r.createdAt || new Date(),
      });
    }
  }

  if (candidates.length > 0) {
    await Notification.insertMany(candidates, { ordered: false }).catch(() => {});
  }

  const activeNotifications = await Notification.find({
    recipient: userId,
    isRead: false,
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  // Final pass deduplication in case duplicates already existed in DB
  const uniqueActive = [];
  const outputSeen = new Set();
  for (const n of activeNotifications) {
    const fp = makeFingerprint(n);
    if (outputSeen.has(fp)) continue;
    outputSeen.add(fp);
    uniqueActive.push({
      id: n._id.toString(),
      title: n.title,
      message: n.message,
      type: n.type,
      severity: n.severity,
      priority: n.severity === 'error' || n.severity === 'warning' ? 'high' : 'normal',
      read: n.isRead,
      link: n.link || null,
      time: n.createdAt,
    });
  }

  return NextResponse.json(uniqueActive.slice(0, 30));
}

// Mark all as read (hides them from active list & prevents re-insertion)
export async function PATCH(req) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const userId = user._id || user.id;

  await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return NextResponse.json({ success: true });
}

// Clear / dismiss all active notifications while keeping `isRead: true` so they don't regenerate
export async function DELETE(req) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const userId = user._id || user.id;

  await Notification.updateMany(
    { recipient: userId, isRead: false },
    { $set: { isRead: true, readAt: new Date() } }
  );

  return NextResponse.json({ success: true });
}