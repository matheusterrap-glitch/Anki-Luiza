import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { id, tableName } = await req.json();
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const targetTable = tableName || "tjsc";

  const { error } = await supabase.from(targetTable).delete().eq("id", id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
