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
  if (!supabase) return NextResponse.json({ 
    error: "Failed to initialize Supabase client",
    hint: "As credenciais estão presentes, mas o cliente não pôde ser criado. Verifique se a URL está no formato correto (https://xyz.supabase.co)."
  }, { status: 500 });
  
  try {
    const { data, error } = await supabase.from(FLASHCARD_TABLES[0]).select("*").limit(1);
    
    if (error) {
       // Check for specific error codes
       let customHint = "Verifique se as tabelas foram criadas no Supabase usando o SQL Editor.";
       if (error.code === '42501') customHint = "Erro de Permissão (RLS). Verifique se você criou a POLICY 'Allow all access' conforme o script SQL.";
       if (error.code === '42P01') customHint = "Tabela não encontrada. Certifique-se de que a tabela 'tjsc' foi criada exatamente com esse nome (em minúsculo).";
       if (error.message && error.message.includes('API key')) customHint = "A chave API (ANON KEY) parece inválida ou expirou.";

       return NextResponse.json({ 
        error: error.message, 
        code: error.code,
        details: error,
        hint: customHint,
        url_used: url
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: "Conexão OK", 
      project_url: url,
      table_checked: FLASHCARD_TABLES[0],
      sample: data?.[0] || "Nenhum card encontrado (tabela vazia)",
      columns: data?.[0] ? Object.keys(data[0]) : "Não foi possível determinar as colunas (tabela vazia)"
    });
  } catch (err: any) {
    return NextResponse.json({ 
      error: "Exceção inesperada", 
      message: err.message,
      hint: "Ocorreu um erro ao tentar se comunicar com o Supabase. Verifique se o projeto está ativo e a URL está correta."
    }, { status: 500 });
  }
}
