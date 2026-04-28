import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const { data, error } = await supabase
    .from("session_stats")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json(error, { status: 500 });
  return NextResponse.json(data || []);
}
