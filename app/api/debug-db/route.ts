import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { FLASHCARD_TABLES } from "@/lib/config";

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    return NextResponse.json({ 
      error: "Supabase not configured", 
      details: {
        url_present: !!url,
        key_present: !!key
      },
      hint: "Certifique-se de que SUPABASE_URL e SUPABASE_ANON_KEY estão configurados nos Secrets do AI Studio."
    }, { status: 500 });
  }

  if (url.includes(key) || url.length > 100) {
    return NextResponse.json({ 
      error: "URL do Supabase Malformada", 
      details: {
        url_length: url.length,
        contains_key: url.includes(key)
      },
      hint: "Parece que você colou a API KEY dentro do campo SUPABASE_URL por engano. A URL deve ser algo como 'https://xyz.supabase.co'."
    }, { status: 500 });
  }

  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Failed to initialize Supabase client" }, { status: 500 });
  
  const { data, error } = await supabase.from(FLASHCARD_TABLES[0]).select("*").limit(1);
  if (error) return NextResponse.json({ 
    error: error.message, 
    details: error,
    hint: "Verifique se as tabelas foram criadas no Supabase usando o SQL Editor."
  }, { status: 500 });
  
  return NextResponse.json({ 
    message: "Conexão OK", 
    sample: data?.[0] || "Nenhum card encontrado",
    columns: data?.[0] ? Object.keys(data[0]) : "Não foi possível determinar as colunas (tabela vazia)"
  });
}
