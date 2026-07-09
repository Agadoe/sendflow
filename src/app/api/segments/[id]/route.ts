import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { NextRequest } from 'next/server';

const VALID_NAME = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;
const VALID_TAG = /^[a-z0-9][a-z0-9-_]{0,62}[a-z0-9]$/;

/**
 * PATCH /api/segments/[id] — update a segment.
 * Body: any of { name, tag, color, description }
 * Ownership check: segment.userId must match session.id.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;
  const { id } = await params;

  const existing = await prisma.segment.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: any = {};
  if (body.name !== undefined) {
    if (!VALID_NAME.test(body.name)) {
      return NextResponse.json({ error: 'Invalid name format' }, { status: 400 });
    }
    data.name = body.name;
  }
  if (body.tag !== undefined) {
    if (!VALID_TAG.test(body.tag)) {
      return NextResponse.json({ error: 'Invalid tag format' }, { status: 400 });
    }
    data.tag = body.tag;
  }
  if (body.color !== undefined) {
    if (body.color !== null && !/^#[0-9A-Fa-f]{6}$/.test(body.color)) {
      return NextResponse.json({ error: 'Invalid color' }, { status: 400 });
    }
    data.color = body.color;
  }
  if (body.description !== undefined) {
    if (body.description && body.description.length > 280) {
      return NextResponse.json({ error: 'description too long' }, { status: 400 });
    }
    data.description = body.description || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
  }

  try {
    const segment = await prisma.segment.update({ where: { id }, data });
    return NextResponse.json({ segment });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return NextResponse.json({ error: 'A segment with that name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to update segment' }, { status: 500 });
  }
}

/**
 * DELETE /api/segments/[id] — delete a segment.
 * Does NOT remove the tag from any contacts (the tag string is just text on
 * Contact.tags; deleting the Segment record only removes the saved filter).
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const request = req as NextRequest;
  const session = await getSession(request);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.id;
  const { id } = await params;

  const existing = await prisma.segment.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.segment.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
