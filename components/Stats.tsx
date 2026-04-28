'use client';

import { Target, TrendingUp, Calendar } from 'lucide-react';

interface StatsProps {
  total: number;
  hits: number;
  misses: number;
}

export default function Stats({ total, hits, misses }: StatsProps) {
  const accuracy = total > 0 ? (hits / total) * 100 : 0;
  
  const getPctColor = (pct: number) => {
    const roundedPct = Math.round(pct);
    if (roundedPct >= 80) return 'text-emerald-600';
    if (roundedPct >= 70) return 'text-yellow-500';
    if (roundedPct >= 60) return 'text-red-600';
    return 'text-black';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl mx-auto mb-12">
      <div 
        className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex items-center gap-4"
      >
        <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
          <Calendar size={24} />
        </div>
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Total Hoje</p>
          <p className="text-2xl font-bold text-zinc-800">{total}</p>
        </div>
      </div>

      <div 
        className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex items-center gap-4"
      >
        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
          <TrendingUp size={24} />
        </div>
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Acertos</p>
          <p className={`text-2xl font-bold ${total > 0 ? 'text-emerald-600' : 'text-black'}`}>{hits}</p>
        </div>
      </div>

      <div 
        className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm flex items-center gap-4"
      >
        <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600">
          <Target size={24} />
        </div>
        <div>
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Precisão</p>
          <p className={`text-2xl font-bold ${getPctColor(accuracy)}`}>{Math.round(accuracy)}%</p>
        </div>
      </div>
    </div>
  );
}
