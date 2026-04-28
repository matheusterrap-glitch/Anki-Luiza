export interface Card {
  id: string;
  materia: string;
  question: string;
  correct: string;
  fundamento: string;
  review_date: string | null;
  days_interval: number;
  hits: number;
  misses: number;
  ultima_resposta: string | null;
  ultimo_resultado: string | null;
  ultima_classificacao: string | null;
  tableName: string;
  prev_classificacao?: string | null;
  prev_review_date?: string | null;
  sessionCategory?: 'new' | 'due' | 'overdue';
}

export type SessionMode = "session" | "single";

export interface SessionConfig {
  numNew: number;
  numReview: number;
  numOverdue: number;
}
