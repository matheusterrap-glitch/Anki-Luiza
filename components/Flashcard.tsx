'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, ChevronRight } from 'lucide-react';

interface Card {
  id: string;
  materia: string;
  question: string;
  correct: string;
  fundamento: string;
}

interface FlashcardProps {
  card: Card;
  onAnswer: (isHit: boolean) => void;
}

export default function Flashcard({ card, onAnswer }: FlashcardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleFlip = () => setIsFlipped(!isFlipped);

  return (
    <div className="w-full max-w-2xl mx-auto perspective-1000">
      <div
        className="relative w-full h-96 transition-all duration-500 preserve-3d cursor-pointer"
        style={{ transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        onClick={handleFlip}
      >
        {/* Front */}
        <div className="absolute inset-0 backface-hidden bg-white border border-zinc-200 rounded-3xl shadow-sm p-8 flex flex-col items-center justify-center text-center">
          <span className="absolute top-6 left-6 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            {card.materia}
          </span>
          <h3 className="text-2xl font-medium text-zinc-800 leading-relaxed">
            {card.question}
          </h3>
          <p className="mt-8 text-sm text-zinc-400 flex items-center gap-2">
            <RotateCcw size={14} /> Clique para ver a resposta
          </p>
        </div>

        {/* Back */}
        <div 
          className="absolute inset-0 backface-hidden bg-white border border-zinc-200 rounded-3xl shadow-sm p-8 flex flex-col items-center justify-center text-center rotate-y-180"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto">
            <h4 className="text-xl font-semibold text-emerald-600 mb-4">Resposta Correta</h4>
            <p className="text-lg text-zinc-700 mb-6">{card.correct}</p>
            {card.fundamento && (
              <div className="bg-zinc-50 p-4 rounded-xl text-left border border-zinc-100 w-full">
                <p className="text-xs font-bold text-zinc-400 uppercase mb-2">Fundamento</p>
                <p className="text-sm text-zinc-600 leading-relaxed italic">&quot;{card.fundamento}&quot;</p>
              </div>
            )}
          </div>
          
          <div className="mt-8 flex gap-4 w-full">
            <button
              onClick={() => onAnswer(false)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-rose-50 text-rose-600 rounded-2xl font-semibold hover:bg-rose-100 transition-colors border border-rose-100"
            >
              <XCircle size={20} /> Errei
            </button>
            <button
              onClick={() => onAnswer(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 px-6 bg-emerald-50 text-emerald-600 rounded-2xl font-semibold hover:bg-emerald-100 transition-colors border border-emerald-100"
            >
              <CheckCircle2 size={20} /> Acertei
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
