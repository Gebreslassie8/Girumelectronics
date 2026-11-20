import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import * as Models from '@/models';
import { requireAuth } from '@/lib/auth';

const { User, Order, Branch, Revenue, Product, Notification } = Models;

export async function GET(req) {
  try {
    const { user, error } = await requireAuth(req);
    if (error) return error;

    await connectDB();

    const userId = user._id || user.id;
    const role = (user.role || 'customer').toLowerCase();
    const isAdmin = role === 'admin' || role === 'owner';
    const events = [];

    // 1. Orders
    if (Order) {
      const orderFilter =
        role === 'customer'
          ? {
              $or: [
                ...(user.phone ? [{ customerPhone: user.phone }] : []),
                ...(userId ? [{ customerId: userId }, { user: userId }] : []),
              ],
            }
          : role === 'seller' && user.branch
          ? { branch: user.branch }
          : {};

      const queryFilter =
        role === 'customer' && (!orderFilter.$or || orderFilter.$or.length === 0)
          ? { _id: null }
          : orderFilter;

      const orders = await Order.find(queryFilter)
        .sort({ createdAt: -1 })
        .limit(12)
        .lean();

      for (const o of orders) {
        const num = o.orderNumber || o._id.toString().slice(-6).toUpperCase();
        const status = (o.status || '').toLowerCase();
        const isDelivered = status === 'delivered' || status === 'completed';
        const isShipped = status === 'shipped' || status === 'in_transit';

        events.push({
          id: `order-${o._id}`,
          type: isDelivered
            ? 'order_delivered'
            : isShipped
            ? 'order_shipped'
            : 'order_created',
          severity: isDelivered || isShipped ? 'success' : 'info',
          title: isDelivered
            ? `ትዕዛዝ #${num} ደርሷል`
            : isShipped
            ? `ትዕዛዝ #${num} ተልኳል`
            : `አዲስ ትዕዛዝ #${num}`,
          description: `${o.customerName || 'ደንበኛ'} — ${o.itemType || 'ምርት'} x ${o.quantity || 1}`,
          amount: Number(o.totalPrice || 0) || undefined,
          actor: { name: o.customerName || 'ደንበኛ' },
          timestamp: o.updatedAt || o.createdAt || new Date().toISOString(),
          link: '/dashboard/orders',
        });
      }
    }

    // 2. Payments / Revenues
    if (Revenue) {
      const revFilter =
        role === 'seller' && user.branch ? { branch: user.branch } : {};

      if (role !== 'customer') {
        const revenues = await Revenue.find(revFilter)
          .sort({ revenueDate: -1, createdAt: -1 })
          .limit(10)
          .lean();

        for (const r of revenues) {
          events.push({
            id: `rev-${r._id}`,
            type: 'payment_received',
            severity: 'success',
            title: 'ክፍያ ተመዝግቧል',
            description: r.description || 'የገቢ ክፍያ',
            amount: Number(r.amount || 0) || undefined,
            actor: { name: r.recordedByName || 'ስርዓት' },
            timestamp: r.revenueDate || r.createdAt || new Date().toISOString(),
            link: '/dashboard/analytics',
          });
        }
      }
    }

    // 3. Low Stock Inventory
    if (Product && (isAdmin || role === 'seller')) {
      const stockFilter = { quantity: { $lte: 5 } };
      if (role === 'seller' && user.branch) {
        stockFilter.branch = user.branch;
      }

      const lowStock = await Product.find(stockFilter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .limit(8)
        .lean();

      for (const p of lowStock) {
        events.push({
          id: `stock-${p._id}`,
          type: 'inventory_low',
          severity: 'warning',
          title: 'ዝቅተኛ ክምችት',
          description: `${p.name} — ${p.quantity} ${p.unit || 'pcs'} ቀሪ`,
          timestamp: p.updatedAt || p.createdAt || new Date().toISOString(),
          link: '/dashboard/inventory',
        });
      }
    }

    // 4. Users & Branches (Admin / Owner)
    if (isAdmin) {
      if (User) {
        const recentUsers = await User.find({})
          .sort({ createdAt: -1 })
          .limit(8)
          .lean();

        for (const u of recentUsers) {
          events.push({
            id: `user-${u._id}`,
            type: 'user_created',
            severity: 'info',
            title: 'አዲስ ተጠቃሚ ተመዝግቧል',
            description: `${u.fullName} — ${u.role || 'customer'}`,
            actor: { name: 'admin' },
            timestamp: u.createdAt || new Date().toISOString(),
            link: '/dashboard/users',
          });
        }
      }

      if (Branch) {
        const recentBranches = await Branch.find({})
          .sort({ createdAt: -1 })
          .limit(6)
          .lean();

        for (const b of recentBranches) {
          events.push({
            id: `branch-${b._id}`,
            type: 'branch_created',
            severity: 'success',
            title: `ቅርንጫፍ "${b.name}"`,
            description: b.address || 'ቅርንጫፍ ተመዝግቧል',
            actor: { name: 'admin' },
            timestamp: b.createdAt || new Date().toISOString(),
            link: '/dashboard/branches',
          });
        }
      }
    }

    // 5. System / User Notifications
    if (Notification && userId) {
      const systemNotifs = await Notification.find({
        recipient: userId,
        type: 'system',
      })
        .sort({ createdAt: -1 })
        .limit(6)
        .lean();

      for (const n of systemNotifs) {
        events.push({
          id: `notif-${n._id}`,
          type: 'system_alert',
          severity: n.severity === 'error' ? 'critical' : n.severity || 'info',
          title: n.title || 'የስርዓት ማሳወቂያ',
          description: n.message || '',
          timestamp: n.createdAt || new Date().toISOString(),
          link: n.link || '/dashboard/settings',
        });
      }
    }

    // Sort newest first
    events.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    return NextResponse.json({ events: events.slice(0, 40) });
  } catch (err) {
    console.error('[GET /api/activity]', err);
    return NextResponse.json(
      { message: 'እንቅስቃሴዎችን መጫን አልተቻለም' },
      { status: 500 }
    );
  }
}