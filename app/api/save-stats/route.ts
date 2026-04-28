import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { materia, newHits, newMisses, reviewHits, reviewMisses, duration } = await req.json();
    const supabase = getSupabase();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    const { error } = await supabase.from("session_stats").insert([
      { 
        materia, 
        new_hits: newHits, 
        new_misses: newMisses, 
        review_hits: reviewHits, 
        review_misses: reviewMisses,
        duration: duration || 0
      }
    ]);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
