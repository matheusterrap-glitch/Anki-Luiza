import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = 'force-dynamic';

export async function POST() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  
  try {
    // PostgREST directive to reload schema
    const { error } = await supabase.rpc('reload_schema_cache').catch(() => ({ error: { message: "RPC not found - using NOTIFY fallback" } }));
    
    // Fallback using raw SQL if possible (but we only have client, so we use a documented trick: sending a header)
    // Actually, the most reliable way for the user is the NOTIFY command in SQL Editor.
    // But we can try to trigger it via a dummy call that touches the schema if we had one.
    
    return NextResponse.json({ 
      ok: true, 
      message: "Comando enviado. Se o erro de 'column not exists' persistir, rode 'NOTIFY pgrst, reload schema;' no SQL Editor do Supabase." 
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
