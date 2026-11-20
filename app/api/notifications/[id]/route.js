import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { Notification } from '@/models';
import { requireAuth } from '@/lib/auth';

async function markDismissed(req, context) {
  const { user, error } = await requireAuth(req);
  if (error) return error;

  const { id } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ success: true });
  }

  await connectDB();
  const userId = user._id || user.id;

  await Notification.findOneAndUpdate(
    { _id: id, recipient: userId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );

  return NextResponse.json({ success: true });
}

export async function PATCH(req, context) {
  return markDismissed(req, context);
}

export async function DELETE(req, context) {
  return markDismissed(req, context);
}