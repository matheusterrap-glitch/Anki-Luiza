import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date();
  const utc8 = new Date(now.getTime() - (8 * 60 * 60 * 1000));
  const today = utc8.toISOString().split('T')[0];
  return NextResponse.json({ today });
}
