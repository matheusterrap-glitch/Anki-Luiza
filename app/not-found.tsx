import Link from 'next/link';
import { Home, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-50 p-6 text-center">
      <div className="w-16 h-16 bg-zinc-100 rounded-2xl flex items-center justify-center text-zinc-400 mb-6">
        <SearchX size={32} />
      </div>
      <h2 className="text-2xl font-bold text-zinc-900 mb-2">Página não encontrada!</h2>
      <p className="text-zinc-500 mb-8 max-w-md leading-relaxed">
        A página que você está procurando não existe ou foi movida para outro lugar.
      </p>
      <Link
        href="/"
        className="flex items-center gap-2 py-3 px-8 bg-indigo-600 text-white rounded-2xl font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
      >
        <Home size={20} /> Voltar ao Início
      </Link>
    </div>
  );
}
