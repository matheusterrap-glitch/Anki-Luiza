import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { id, isHit, today, tableName } = await req.json();
    const result = isHit ? 'Acerto' : 'Erro';
    const supabase = getSupabase();
    if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

    const targetTable = tableName || "tjsc";

    // 1. Fetch current hits/misses
    const { data: current, error: fetchError } = await supabase
      .from(targetTable)
      .select("hits, misses")
      .eq("id", id)
      .single();

    if (fetchError) {
      return NextResponse.json({ 
        error: "Card não encontrado no banco de dados.", 
        details: fetchError.message 
      }, { status: 500 });
    }

    // 2. Prepare update
    const updateData: any = {
      hits: (current?.hits || 0) + (isHit ? 1 : 0),
      misses: (current?.misses || 0) + (isHit ? 0 : 1),
      ultimo_resultado: result
    };

    if (today) {
      updateData.ultima_resposta = today;
    }

    // 3. Perform update
    const { error: updateError } = await supabase
      .from(targetTable)
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      if (updateError.message?.includes('column')) {
        return NextResponse.json({ 
          error: "Erro de Sincronização (Schema Cache)", 
          details: `O Supabase ainda não reconhece a coluna: ${updateError.message}. Mesmo que ela exista no banco, a API precisa ser atualizada.`,
          suggestion: "No painel do Supabase, vá em Settings -> API -> PostgREST e clique em 'Reload Schema', ou rode o SQL de migração novamente com o comando NOTIFY pgrst, 'reload schema';"
        }, { status: 400 });
      }

      return NextResponse.json({ 
        error: "Erro ao atualizar card.", 
        details: updateError.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({ ok: true, today, ultimoResultado: result });
  } catch (err) {
    return NextResponse.json({ error: "Erro interno no servidor." }, { status: 500 });
  }
}
