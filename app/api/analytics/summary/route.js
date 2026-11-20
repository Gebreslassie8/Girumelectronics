import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Order, Product, Expense, Revenue } from '@/models';
import { requireAuth } from '@/lib/auth';

export async function GET(req) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const branchFilter = ['admin', 'owner'].includes(user.role) ? {} : { branch: user.branch };

  const [orderCount, productCount, revenueAgg, expenseAgg] = await Promise.all([
    Order.countDocuments(branchFilter),
    Product.countDocuments(branchFilter),
    Revenue.aggregate([{ $match: branchFilter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Expense.aggregate([{ $match: branchFilter }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);

  const totalRevenue = revenueAgg[0]?.total || 0;
  const totalExpenses = expenseAgg[0]?.total || 0;

  return NextResponse.json({
    orderCount,
    productCount,
    totalRevenue,
    totalExpenses,
    totalProfit: totalRevenue - totalExpenses,
  });
}