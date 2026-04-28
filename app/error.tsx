'use client';

// Force rebuild of error component - v2
import { useEffect } from 'react';
import { RotateCcw, AlertTriangle } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-6 text-center">
      <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 mb-6">
        <AlertTriangle size={32} />
      </div>
      <h2 className="text-2xl font-bold text-zinc-900 mb-2">Algo deu errado!</h2>
      <p className="text-zinc-500 mb-8 max-w-md">
        Ocorreu um erro inesperado ao carregar a aplicação. Por favor, tente novamente.
      </p>
      <button
        onClick={() => reset()}
        className="flex items-center gap-2 py-3 px-8 bg-indigo-600 text-white rounded-2xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
      >
        <RotateCcw size={20} /> Tentar Novamente
      </button>
    </div>
  );
}
