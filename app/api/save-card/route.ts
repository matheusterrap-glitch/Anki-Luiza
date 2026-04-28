import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { id, reviewDate, daysInterval, ultimaClassificacao, tableName, question, correct, fundamento } = await req.json();
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const targetTable = tableName || "tjsc";

  const updateData: any = {};
  if (reviewDate !== undefined) updateData.review_date = reviewDate;
  if (daysInterval !== undefined) updateData.days_interval = daysInterval;
  if (ultimaClassificacao !== undefined) updateData.ultima_classificacao = ultimaClassificacao;
  if (question !== undefined) updateData.question = question;
  if (correct !== undefined) updateData.correct = correct;
  if (fundamento !== undefined) updateData.fundamento = fundamento;

  const { error } = await supabase
    .from(targetTable)
    .update(updateData)
    .eq("id", id);

  if (error) {
    return NextResponse.json({ 
      error: "Erro ao salvar card.", 
      details: error.message 
    }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
