import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { FLASHCARD_TABLES } from "@/lib/config";

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });

  const tables = FLASHCARD_TABLES;
  
  try {
    const allCards: any[] = [];

    for (const table of tables) {
      let tableData: any[] = [];
      let from = 0;
      const chunkSize = 1000;
      const maxPerTable = 10000;

      while (tableData.length < maxPerTable) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .range(from, from + chunkSize - 1);

        if (error) {
          console.error(`[Supabase Error] Table: ${table}`, error);
          const errorMsg = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
          return NextResponse.json({ 
            error: `Erro na tabela "${table}": ${errorMsg}`, 
            details: error,
            code: error.code,
            hint: error.hint,
            table: table
          }, { status: 500 });
        }

        if (!data || data.length === 0) break;

        tableData = [...tableData, ...data];
        if (data.length < chunkSize) break;
        from += chunkSize;
      }

      allCards.push(...tableData.map((card: any) => ({ ...card, tableName: table })));
    }

    return NextResponse.json(allCards);
  } catch (error) {
    console.error("Failed to fetch cards:", error);
    return NextResponse.json({ error: "Failed to fetch cards" }, { status: 500 });
  }
}
