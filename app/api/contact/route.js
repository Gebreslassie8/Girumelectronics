import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, default: '' },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ['new', 'read', 'replied'], default: 'new' },
  },
  { timestamps: true }
);

const ContactMessage =
  mongoose.models.ContactMessage ||
  mongoose.model('ContactMessage', contactMessageSchema);

export async function POST(req) {
  try {
    await connectDB();
    const body = await req.json();

    const name = String(body?.name || '').trim();
    const phone = String(body?.phone || '').trim();
    const email = String(body?.email || '').trim();
    const message = String(body?.message || '').trim();

    if (!name || !phone || !message) {
      return NextResponse.json(
        { message: 'እባክዎ ስም፣ ስልክ እና መልዕክት ያስገቡ' },
        { status: 400 }
      );
    }

    const doc = await ContactMessage.create({ name, phone, email, message });

    return NextResponse.json(
      { ok: true, id: doc._id, message: 'መልዕክት ተልኳል' },
      { status: 201 }
    );
  } catch (err) {
    console.error('[POST /api/contact]', err);
    return NextResponse.json(
      { message: 'መልዕክት መላክ አልተቻለም' },
      { status: 500 }
    );
  }
}