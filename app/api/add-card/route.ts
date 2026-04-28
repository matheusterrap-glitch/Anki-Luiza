import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { materia, question, correct, fundamento, tableName } = await req.json();
  const id = 'ID' + Math.random().toString(36).substr(2, 9).toUpperCase();
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const targetTable = tableName || "tjsc"; // Default to tjsc if not provided

  const { error } = await supabase.from(targetTable).insert([
    { id, materia, question, correct, fundamento }
  ]);

  if (error) {
    return NextResponse.json({ 
      error: "Erro ao adicionar card.", 
      details: error.message 
    }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id });
}
