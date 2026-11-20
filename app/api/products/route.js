import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Product } from '@/models';
import { requireAuth } from '@/lib/auth';

export async function GET(req) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const filter = ['admin', 'owner'].includes(user.role)
    ? {}
    : { branch: user.branch };
  const products = await Product.find(filter).sort({ createdAt: -1 }).lean();
  return NextResponse.json(products);
}

export async function POST(req) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const body = await req.json();
  const product = await Product.create({
    ...body,
    branch: user.branch || body.branch,
    createdBy: user._id,
  });
  return NextResponse.json(product, { status: 201 });
}