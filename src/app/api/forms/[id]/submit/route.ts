import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { phone, answers } = body;

  if (!phone) {
    return NextResponse.json({ error: 'phone required' }, { status: 400 });
  }

  const form = await prisma.whatsAppForm.findUnique({ where: { id } });
  if (!form || !form.isActive) {
    return NextResponse.json({ error: 'Form not found or inactive' }, { status: 404 });
  }

  const cleanPhone = phone.replace(/\D/g, '');

  // Save submission
  const submission = await prisma.whatsAppFormSubmission.create({
    data: {
      formId: id,
      phone: cleanPhone,
      answers: JSON.stringify(answers || {}),
    },
  });

  // Save as contact (upsert)
  let contact = await prisma.contact.findFirst({
    where: { userId: form.userId, phone: cleanPhone },
  });

  const contactData: any = { phone: cleanPhone };
  let tags: string[] = [];
  if (contact) {
    try { tags = JSON.parse(contact.tags || '[]'); } catch {}
  }
  if (form.tagName && form.tagValue) {
    if (!tags.includes(form.tagValue)) tags.push(form.tagValue);
    contactData.tags = JSON.stringify(tags);
  }

  if (contact) {
    await prisma.contact.update({ where: { id: contact.id }, data: contactData });
  } else {
    contact = await prisma.contact.create({
      data: { userId: form.userId, phone: cleanPhone, tags: contactData.tags || '[]' },
    });
  }

  // Build WhatsApp link to open chat
  const base = `https://wa.me/${cleanPhone}`;
  const encoded = encodeURIComponent(form.prefillMsg || '');
  const waUrl = encoded ? `${base}?text=${encoded}` : base;

  return NextResponse.json({ success: true, submission, contact, waUrl });
}