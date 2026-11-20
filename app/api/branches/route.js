import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { Branch } from '@/models';
import { requireAuth, requireRole } from '@/lib/auth';

// GET /api/branches
export async function GET(req) {
  const { error } = await requireAuth(req);
  if (error) return error;

  await connectDB();
  const branches = await Branch.find({})
    .populate('manager', 'fullName phone email role')
    .sort({ name: 1 })
    .lean();
  return NextResponse.json(branches);
}

// POST /api/branches
export async function POST(req) {
  const { error } = await requireRole(req, 'admin', 'owner');
  if (error) return error;

  try {
    await connectDB();
    const body = await req.json();
    const { name, address, phone, manager, isActive } = body;

    if (!name || !address) {
      return NextResponse.json(
        { error: 'ስም እና አድራሻ ያስፈልጋሉ' },
        { status: 400 }
      );
    }

    // Auto-generate code: BR-2026-001
    const year = new Date().getFullYear();
    const count = await Branch.countDocuments({
      code: new RegExp('^BR-' + year + '-'),
    });
    const code = body.code || `BR-${year}-${String(count + 1).padStart(3, '0')}`;

    const branch = await Branch.create({
      name: name.trim(),
      address: address.trim(),
      phone: phone?.trim() || undefined,
      code,
      manager: manager || null,
      isActive: isActive ?? true,
    });

    await branch.populate('manager', 'fullName phone email role');

    return NextResponse.json(branch, { status: 201 });
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json(
        { error: 'ይህ ኮድ ወይም ስም ቀድሞ ተመዝግቧል' },
        { status: 409 }
      );
    }
    if (err.name === 'ValidationError') {
      const errs = {};
      for (const k of Object.keys(err.errors)) errs[k] = err.errors[k].message;
      return NextResponse.json(
        { error: 'ማረጋገጫ አልተሳካም', errors: errs },
        { status: 400 }
      );
    }
    console.error('[branches:POST]', err);
    return NextResponse.json(
      { error: 'ቅርንጫፍ መፍጠር አልተሳካም' },
      { status: 500 }
    );
  }
}