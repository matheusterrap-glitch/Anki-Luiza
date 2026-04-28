import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

import { FLASHCARD_TABLES } from "@/lib/config";

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const tables = FLASHCARD_TABLES;
  
  try {
    await Promise.all(
      tables.map(table => supabase.from(table).delete().neq("id", "0"))
    );
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
