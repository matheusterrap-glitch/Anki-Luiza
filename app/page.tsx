'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Brain, 
  Play, 
  Trash2, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  RotateCcw, 
  Search,
  BookOpen,
  Calendar,
  BarChart3,
  ArrowLeft,
  Home,
  X,
  Database,
  Pencil,
  Clock
} from 'lucide-react';
import { Card, SessionMode, SessionConfig } from '@/lib/types';
import { FLASHCARD_TABLES, TABLE_DISPLAY_NAMES } from '@/lib/config';

export default function Page() {
  const [cards, setCards] = useState<Card[]>([]);
  const [today, setToday] = useState<string>('');
  const [view, setView] = useState<'home' | 'study' | 'end' | 'add' | 'database' | 'calendar' | 'stats'>('home');
  
  // Session State
  const [currentSession, setCurrentSession] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mode, setMode] = useState<SessionMode>("session");
  const [savedSession, setSavedSession] = useState<{ list: Card[], index: number } | null>(null);
  const [config, setConfig] = useState<SessionConfig>({ numNew: 20, numReview: 40, numOverdue: 0 });
  const [selectedMateria, setSelectedMateria] = useState<string | null>(null);
  
  // Session Stats
  const [sessionStats, setSessionStats] = useState({
    newHits: 0,
    newMisses: 0,
    reviewHits: 0,
    reviewMisses: 0,
    overdueHits: 0,
    overdueMisses: 0
  });

  const [historyStats, setHistoryStats] = useState<any[]>([]);
  
  // Session Timer State
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionDuration, setSessionDuration] = useState<number>(0);
  
  // Study State
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Question, 2: Gabarito + Classify, 3: Summary, 4: Next Action
  const [lastResult, setLastResult] = useState<{ isHit: boolean, result: string, userChoice: string } | null>(null);
  const [summary, setSummary] = useState<{ label: string, days: number } | null>(null);
  const [calculatedDays, setCalculatedDays] = useState<Record<string, number>>({});

  const [isSupabaseConfigured, setIsSupabaseConfigured] = useState<boolean>(true);
  const [generalError, setGeneralError] = useState<string | null>(null);
  
  // Form State
  const [newCard, setNewCard] = useState({ materia: '', question: '', correct: 'Certo', fundamento: '' });

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [selectedCardInfo, setSelectedCardInfo] = useState<Card | null>(null);

  const SLOT_QUOTAS: Record<string, number> = useMemo(() => ({
    "Errei Outra Vez": 5,
    "Errei": 10,
    "Acertei 2ª Chance": 5,
    "Acertei Chutando": 6,
    "Acertei com Dúvida": 9,
    "Acertei": 3,
    "Acertei Tranquilo": 2
  }), []);

  const getNextDate = useCallback((dateStr: string, days: number) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 1, day));
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().split('T')[0];
  }, []);

  const scheduledReviews = useMemo(() => {
    const schedule: Record<string, Record<string, Card[]>> = {};
    const assignedCardIds = new Set<string>();
    
    const answeredCardsByMateria: Record<string, Card[]> = {};
    FLASHCARD_TABLES.forEach(materia => {
      answeredCardsByMateria[materia] = cards.filter(c => c.tableName === materia && c.ultima_classificacao);
    });

    // Simulate for 60 days to cover the calendar and future sessions
    for (let i = 0; i < 60; i++) {
      const date = getNextDate(today, i);
      if (!date) continue;
      
      schedule[date] = {};

      FLASHCARD_TABLES.forEach(materia => {
        const available = (answeredCardsByMateria[materia] || []).filter(c => {
          if (assignedCardIds.has(c.id)) return false;
          
          const isAnsweredToday = c.ultima_resposta === today;

          if (date === today) {
            // For today, we include:
            // 1. Cards that were due at the start of the day and are now answered (to occupy their slots)
            // 2. Cards that are currently due and not yet answered
            
            if (isAnsweredToday) {
              // Was it a review card? (hits+misses > 1)
              if ((c.hits + c.misses) <= 1) return false;
              
              // Was it due at the start of the day?
              const originalReviewDate = c.prev_review_date || c.review_date;
              const wasDue = originalReviewDate && originalReviewDate === date;
              return wasDue;
            }

            // Not answered today: is it due?
            const isDue = c.review_date && c.review_date === date;
            return isDue;
          }

          // For future dates
          if (isAnsweredToday) return false;
          const isDue = c.review_date && c.review_date === date;
          return isDue;
        });

        const dueForThisDay: Card[] = [];
        const selectedIds = new Set<string>();

        // 1. Fill by categories first (respecting spaced repetition quotas)
        Object.entries(SLOT_QUOTAS).forEach(([cat, quota]) => {
          const inCat = available.filter(c => {
            const currentClass = (date === today && c.ultima_resposta === today && c.prev_classificacao)
              ? c.prev_classificacao
              : c.ultima_classificacao;
            return currentClass === cat;
          });
          
          // Prioritize answered cards within the category for today, otherwise sort by oldest review date (most overdue)
          inCat.sort((a, b) => {
            if (date === today) {
              const aDone = a.ultima_resposta === today;
              const bDone = b.ultima_resposta === today;
              if (aDone && !bDone) return -1;
              if (!aDone && bDone) return 1;
              
              const revA = a.review_date ? new Date(a.review_date).getTime() : 0;
              const revB = b.review_date ? new Date(b.review_date).getTime() : 0;
              if (revA !== revB) return revA - revB;

              return a.id.localeCompare(b.id);
            }
            const dateA = a.ultima_resposta ? new Date(a.ultima_resposta).getTime() : 0;
            const dateB = b.ultima_resposta ? new Date(b.ultima_resposta).getTime() : 0;
            return dateA - dateB;
          });

          const selected = inCat.slice(0, quota);
          selected.forEach(c => {
            if (!selectedIds.has(c.id)) {
              selectedIds.add(c.id);
              dueForThisDay.push(c);
              assignedCardIds.add(c.id);
            }
          });
        });

        // 2. Global Cap Logic for Today: 
        // If we haven't reached 40 cards and there are more answered cards that were due, 
        // include them to "fill" the daily quota and reduce the "Due" count.
        if (date === today && dueForThisDay.length < 40) {
          const answeredTodayInPool = available.filter(c => c.ultima_resposta === today && !selectedIds.has(c.id));
          const extraToTake = 40 - dueForThisDay.length;
          const extra = answeredTodayInPool.slice(0, extraToTake);
          
          extra.forEach(c => {
            selectedIds.add(c.id);
            dueForThisDay.push(c);
            assignedCardIds.add(c.id);
          });
        }
        
        // Final schedule assignment
        schedule[date][materia] = date === today 
          ? dueForThisDay.filter(c => c.ultima_resposta !== today)
          : dueForThisDay;
      });
    }
    return schedule;
  }, [cards, today, getNextDate, SLOT_QUOTAS]);

  const getDueCardsForMateriaAndDate = useCallback((materia: string, targetDate: string, _allCards: Card[]) => {
    return scheduledReviews[targetDate]?.[materia] || [];
  }, [scheduledReviews]);

  const findNextAvailableSlot = useCallback((card: Card, label: string, currentCards: Card[]) => {
    const minDaysMap: Record<string, number> = {
      "Errei Outra Vez": 1,
      "Errei": 2,
      "Acertei 2ª Chance": 3,
      "Acertei Chutando": 4,
      "Acertei com Dúvida": 5,
      "Acertei": 7,
      "Acertei Tranquilo": 9
    };
    
    let days = minDaysMap[label] || 3;
    let reviewDate = getNextDate(today, days);
    const quota = SLOT_QUOTAS[label] || 1;

    while (true) {
      const scheduledForDate = currentCards.filter(c => 
        c.tableName === card.tableName && 
        c.review_date === reviewDate && 
        c.ultima_classificacao === label &&
        c.id !== card.id
      );

      if (scheduledForDate.length < quota) {
        return { days, reviewDate };
      }
      days++;
      reviewDate = getNextDate(today, days);
      if (days > 1000) return { days, reviewDate };
    }
  }, [today, getNextDate, SLOT_QUOTAS]);

  const RANGES = useMemo(() => {
    const totalQuestions = selectedMateria 
      ? cards.filter(c => c.tableName === selectedMateria).length 
      : cards.length;
    
    if (totalQuestions <= 500) {
      return {
        "Errei": { min: 2, max: 4, color: "bg-rose-500", type: 'miss' },
        "Errei Outra Vez": { min: 1, max: 3, color: "bg-zinc-900", type: 'miss' },
        "Acertei 2ª Chance": { min: 3, max: 5, color: "bg-emerald-100", type: 'hit' },
        "Acertei Chutando": { min: 4, max: 6, color: "bg-amber-400", type: 'hit' },
        "Acertei com Dúvida": { min: 5, max: 8, color: "bg-blue-600", type: 'hit' },
        "Acertei": { min: 7, max: 12, color: "bg-emerald-600", type: 'hit' },
        "Acertei Tranquilo": { min: 9, max: 15, color: "bg-lime-400", type: 'hit' }
      };
    } else if (totalQuestions <= 2500) {
      return {
        "Errei": { min: 2, max: 5, color: "bg-rose-500", type: 'miss' },
        "Errei Outra Vez": { min: 1, max: 4, color: "bg-zinc-900", type: 'miss' },
        "Acertei 2ª Chance": { min: 3, max: 7, color: "bg-emerald-100", type: 'hit' },
        "Acertei Chutando": { min: 4, max: 10, color: "bg-amber-400", type: 'hit' },
        "Acertei com Dúvida": { min: 5, max: 12, color: "bg-blue-600", type: 'hit' },
        "Acertei": { min: 7, max: 15, color: "bg-emerald-600", type: 'hit' },
        "Acertei Tranquilo": { min: 9, max: 20, color: "bg-lime-400", type: 'hit' }
      };
    } else if (totalQuestions <= 5000) {
      return {
        "Errei": { min: 2, max: 6, color: "bg-rose-500", type: 'miss' },
        "Errei Outra Vez": { min: 1, max: 5, color: "bg-zinc-900", type: 'miss' },
        "Acertei 2ª Chance": { min: 3, max: 10, color: "bg-emerald-100", type: 'hit' },
        "Acertei Chutando": { min: 4, max: 15, color: "bg-amber-400", type: 'hit' },
        "Acertei com Dúvida": { min: 5, max: 20, color: "bg-blue-600", type: 'hit' },
        "Acertei": { min: 7, max: 25, color: "bg-emerald-600", type: 'hit' },
        "Acertei Tranquilo": { min: 9, max: 40, color: "bg-lime-400", type: 'hit' }
      };
    } else if (totalQuestions <= 10000) {
      return {
        "Errei": { min: 2, max: 10, color: "bg-rose-500", type: 'miss' },
        "Errei Outra Vez": { min: 1, max: 8, color: "bg-zinc-900", type: 'miss' },
        "Acertei 2ª Chance": { min: 3, max: 15, color: "bg-emerald-100", type: 'hit' },
        "Acertei Chutando": { min: 4, max: 20, color: "bg-amber-400", type: 'hit' },
        "Acertei com Dúvida": { min: 5, max: 30, color: "bg-blue-600", type: 'hit' },
        "Acertei": { min: 7, max: 45, color: "bg-emerald-600", type: 'hit' },
        "Acertei Tranquilo": { min: 9, max: 60, color: "bg-lime-400", type: 'hit' }
      };
    } else {
      return {
        "Errei": { min: 2, max: 15, color: "bg-rose-500", type: 'miss' },
        "Errei Outra Vez": { min: 1, max: 10, color: "bg-zinc-900", type: 'miss' },
        "Acertei 2ª Chance": { min: 3, max: 20, color: "bg-emerald-100", type: 'hit' },
        "Acertei Chutando": { min: 4, max: 30, color: "bg-amber-400", type: 'hit' },
        "Acertei com Dúvida": { min: 5, max: 45, color: "bg-blue-600", type: 'hit' },
        "Acertei": { min: 7, max: 60, color: "bg-emerald-600", type: 'hit' },
        "Acertei Tranquilo": { min: 9, max: 100, color: "bg-lime-400", type: 'hit' }
      };
    }
  }, [selectedMateria, cards]);


  const [showSqlModal, setShowSqlModal] = useState(false);

  const TABLES = FLASHCARD_TABLES;
  
  const [interruptedSessions, setInterruptedSessions] = useState<Record<string, Card[]>>({});

  const completedTables = useMemo(() => {
    const completed: Record<string, boolean> = {};
    if (!today) return completed;
    
    TABLES.forEach(table => {
      const tableCards = cards.filter(c => c.tableName === table);
      
      // Cards respondidos hoje
      const answeredToday = tableCards.filter(c => c.ultima_resposta === today);
      
      // Um card era "inédito" se foi respondido hoje e foi sua primeira vez (hits + misses == 1)
      const answeredNewToday = answeredToday.filter(c => (c.hits + c.misses) === 1).length;

      // Cards que ainda faltam (inéditos e devidos)
      const currentNewCards = tableCards.filter(c => !c.review_date).length;
      const currentDueCards = getDueCardsForMateriaAndDate(table, today, cards).length;

      // Total disponível no início do dia
      const totalNewAtStart = currentNewCards + answeredNewToday;

      // Metas dinâmicas: 20 inéditas
      const targetNew = Math.min(totalNewAtStart, 20);

      // Verifica se as metas foram atingidas
      // Para as inéditas: atingiu a meta de 20 ou acabou as inéditas
      // Para as revisões: não pode haver nenhuma pendente para hoje (já que o sistema limita a 40)
      if (answeredNewToday >= targetNew && currentDueCards === 0) {
        // Apenas marca como concluído se a matéria tiver cards
        if (tableCards.length > 0) {
          completed[table] = true;
        }
      }
    });
    return completed;
  }, [cards, today, TABLES, getDueCardsForMateriaAndDate]);

  const calendarData = useMemo(() => {
    const data: Record<string, { total: number, subjects: Record<string, number> }> = {};
    const overdueSubjects: Record<string, number> = {};
    let overdueTotal = 0;

    // Calculate Overdue
    TABLES.forEach(materia => {
      const overdueCards = cards.filter(c => c.tableName === materia && c.review_date && c.review_date < today && c.ultima_resposta !== today);
      if (overdueCards.length > 0) {
        overdueTotal += overdueCards.length;
        overdueSubjects[materia] = overdueCards.length;
      }
    });
    
    // Calculate for next 30 days to show a good calendar
    for (let i = 0; i < 30; i++) {
      const date = getNextDate(today, i);
      if (!date) continue;

      TABLES.forEach(materia => {
        const due = getDueCardsForMateriaAndDate(materia, date, cards);
        if (due.length > 0) {
          if (!data[date]) data[date] = { total: 0, subjects: {} };
          data[date].total += due.length;
          data[date].subjects[materia] = (data[date].subjects[materia] || 0) + due.length;
        }
      });
    }

    return {
      overdue: overdueTotal > 0 ? { total: overdueTotal, subjects: overdueSubjects } : null,
      upcoming: Object.entries(data).sort((a, b) => a[0].localeCompare(b[0]))
    };
  }, [cards, today, TABLES, getNextDate, getDueCardsForMateriaAndDate]);

  const fetchStats = React.useCallback(async () => {
    try {
      const res = await fetch('/api/get-stats');
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistoryStats(data);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  const fetchData = React.useCallback(async () => {
    try {
      const [todayRes, cardsRes] = await Promise.all([
        fetch('/api/today').then(r => r.json()),
        fetch('/api/cards').then(r => r.json())
      ]);
      setToday(todayRes.today);
      
      if (Array.isArray(cardsRes)) {
        // Restore original state from localStorage to maintain stable slots today
        const savedMap = typeof window !== 'undefined' ? localStorage.getItem(`daily_state_map_${todayRes.today}`) : null;
        const map = savedMap ? JSON.parse(savedMap) : {};
        
        const cardsWithPrev = cardsRes.map((c: any) => ({
          ...c,
          prev_classificacao: map[c.id]?.class || null,
          prev_review_date: map[c.id]?.reviewDate || null
        }));
        
        setCards(cardsWithPrev);
        setIsSupabaseConfigured(true);
        setGeneralError(null);
      } else {
        if (cardsRes && cardsRes.error === "Supabase not configured") {
          setIsSupabaseConfigured(false);
        } else if (cardsRes && cardsRes.error) {
          setGeneralError(cardsRes.error);
        }
        
        const errorString = JSON.stringify(cardsRes).toLowerCase();
        if (cardsRes && (
          errorString.includes('column') || 
          errorString.includes('relation') || 
          errorString.includes('tabela') ||
          errorString.includes('not found')
        )) {
          setShowSqlModal(true);
        }
        setCards([]);
      }
      fetchStats();
    } catch (error) {
      console.error("Error fetching data:", error);
      setCards([]);
    }
  }, [fetchStats]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const deckStats = useMemo(() => {
    const total = cards.length;
    const newCards = cards.filter(c => !c.review_date).length;
    
    let dueCards = 0;
    let overdueCards = 0;
    TABLES.forEach(materia => {
      dueCards += getDueCardsForMateriaAndDate(materia, today, cards).length;
      overdueCards += cards.filter(c => c.tableName === materia && c.review_date && c.review_date < today && c.ultima_resposta !== today).length;
    });

    return { total, newCards, dueCards, overdueCards };
  }, [cards, today, TABLES, getDueCardsForMateriaAndDate]);

  const tableStats = useMemo(() => {
    return TABLES.map(table => {
      const tableCards = cards.filter(c => c.tableName === table);
      const total = tableCards.length;
      const newCards = tableCards.filter(c => !c.review_date).length;
      const dueCards = getDueCardsForMateriaAndDate(table, today, cards).length;
      const overdueCards = tableCards.filter(c => c.review_date && c.review_date < today && c.ultima_resposta !== today).length;
      return { table, total, newCards, dueCards, overdueCards };
    });
  }, [cards, today, TABLES, getDueCardsForMateriaAndDate]);

  const todayStats = useMemo(() => {
    if (!today || historyStats.length === 0) return { hits: 0, misses: 0, duration: 0 };
    
    const todayRecords = historyStats.filter(stat => {
      // Use the same -8h offset as the 'today' variable and the History view
      const d = new Date(stat.created_at);
      const offsetDate = new Date(d.getTime() - (8 * 60 * 60 * 1000));
      const statDate = offsetDate.toISOString().split('T')[0];
      return statDate === today;
    });

    const hits = todayRecords.reduce((acc, curr) => acc + curr.new_hits + curr.review_hits, 0);
    const misses = todayRecords.reduce((acc, curr) => acc + curr.new_misses + curr.review_misses, 0);
    const duration = todayRecords.reduce((acc, curr) => acc + curr.duration, 0);
    
    return { hits, misses, duration };
  }, [historyStats, today]);

  const fullHistoryStats = useMemo(() => {
    // Global stats calculated from all cards (all time)
    const globalTotalHits = cards.reduce((acc, c) => acc + (c.hits || 0), 0);
    const globalTotalMisses = cards.reduce((acc, c) => acc + (c.misses || 0), 0);
    const globalUniqueAnswered = cards.filter(c => (c.hits || 0) + (c.misses || 0) > 0).length;
    const globalTotalDuration = historyStats.reduce((acc, curr) => acc + (curr.duration || 0), 0);

    const statsByMateria: Record<string, {
      totalHits: number,
      totalMisses: number,
      uniqueAnswered: number,
    }> = {};

    TABLES.forEach(table => {
      const tableCards = cards.filter(c => c.tableName === table);
      const hits = tableCards.reduce((acc, c) => acc + (c.hits || 0), 0);
      const misses = tableCards.reduce((acc, c) => acc + (c.misses || 0), 0);
      const unique = tableCards.filter(c => (c.hits || 0) + (c.misses || 0) > 0).length;
      
      statsByMateria[table] = {
        totalHits: hits,
        totalMisses: misses,
        uniqueAnswered: unique
      };
    });

    return {
      statsByMateria,
      global: {
        totalHits: globalTotalHits,
        totalMisses: globalTotalMisses,
        uniqueAnswered: globalUniqueAnswered,
        totalDuration: globalTotalDuration
      }
    };
  }, [cards, TABLES, historyStats]);

  const shuffle = <T,>(arr: T[]): T[] => {
    const newArr = [...arr];
    for (let i = newArr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
  };

  const startSession = (tableName?: string) => {
    if (tableName && interruptedSessions[tableName]) {
      const session = interruptedSessions[tableName];
      // Remove from interrupted
      setInterruptedSessions(prev => {
        const next = { ...prev };
        delete next[tableName];
        return next;
      });
      
      setSessionStats({
        newHits: 0,
        newMisses: 0,
        reviewHits: 0,
        reviewMisses: 0,
        overdueHits: 0,
        overdueMisses: 0
      });
      setSelectedMateria(tableName);
      setCurrentSession(session);
      setCurrentIndex(0);
      setMode("session");
      setStep(1);
      setView('study');
      setSessionStartTime(Date.now());
      return;
    }

    const pool = tableName ? cards.filter(c => c.tableName === tableName) : cards;
    const newPool = pool.filter(c => !c.review_date);
    
    let duePool: Card[] = [];
    if (tableName) {
      duePool = getDueCardsForMateriaAndDate(tableName, today, cards).map(c => ({ ...c, sessionCategory: 'due' as const }));
    } else {
      TABLES.forEach(t => {
        duePool.push(...getDueCardsForMateriaAndDate(t, today, cards).map(c => ({ ...c, sessionCategory: 'due' as const })));
      });
    }

    // Overdue pool: cards that are overdue but NOT in the duePool (to avoid duplicates)
    const dueIds = new Set(duePool.map(c => c.id));
    const overduePool = pool
      .filter(c => c.review_date && c.review_date < today && c.ultima_resposta !== today && !dueIds.has(c.id))
      .sort((a, b) => {
        const dateA = a.review_date ? new Date(a.review_date).getTime() : 0;
        const dateB = b.review_date ? new Date(b.review_date).getTime() : 0;
        return dateA - dateB; // Oldest first
      })
      .map(c => ({ ...c, sessionCategory: 'overdue' as const }));

    let numNew = Math.min(newPool.length, config.numNew);
    let numOverdue = Math.min(overduePool.length, config.numOverdue);
    
    const selectedNew = shuffle(newPool).slice(0, numNew).map(c => ({ ...c, sessionCategory: 'new' as const }));
    const selectedDue = shuffle(duePool).slice(0, config.numReview);
    const selectedOverdue = overduePool.slice(0, numOverdue); // Don't shuffle overdue to keep oldest priority
    const session = shuffle([...selectedNew, ...selectedDue, ...selectedOverdue]);

    if (session.length === 0) {
      console.log('Não há cards para esta sessão.');
      return;
    }

    setSessionStats({
      newHits: 0,
      newMisses: 0,
      reviewHits: 0,
      reviewMisses: 0,
      overdueHits: 0,
      overdueMisses: 0
    });
    setSelectedMateria(tableName || null);
    setCurrentSession(session);
    setCurrentIndex(0);
    setMode("session");
    setStep(1);
    setView('study');
    setSessionStartTime(Date.now());
  };

  const showCardInfo = (id: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) {
      console.log('ID não encontrado.');
      return;
    }
    setSelectedCardInfo(card);
  };

  const startById = (id: string) => {
    const card = cards.find(c => c.id === id);
    if (!card) {
      console.log('ID não encontrado.');
      return;
    }

    if (mode === "session" && currentSession.length > 0) {
      setSavedSession({ list: [...currentSession], index: currentIndex });
    }

    setCurrentSession([card]);
    setCurrentIndex(0);
    setMode("single");
    setStep(1);
    setView('study');
  };

  const handleAnswer = async (userChoice: string) => {
    try {
      const card = currentSession[currentIndex];
      if (!card) return;

      const isHit = userChoice.toLowerCase() === card.correct.toLowerCase();
      const isNew = card.sessionCategory === 'new';
      const isOverdue = card.sessionCategory === 'overdue';

      const response = await fetch('/api/record-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: card.id, isHit, today, tableName: card.tableName })
      });

      const res = await response.json();

      if (response.ok && res.ok) {
        setLastResult({ isHit, result: res.ultimoResultado, userChoice });
        
        // Update stats
        setSessionStats(prev => {
          if (isNew) {
            return { ...prev, newHits: prev.newHits + (isHit ? 1 : 0), newMisses: prev.newMisses + (isHit ? 0 : 1) };
          } else if (isOverdue) {
            return { ...prev, overdueHits: prev.overdueHits + (isHit ? 1 : 0), overdueMisses: prev.overdueMisses + (isHit ? 0 : 1) };
          } else {
            return { ...prev, reviewHits: prev.reviewHits + (isHit ? 1 : 0), reviewMisses: prev.reviewMisses + (isHit ? 0 : 1) };
          }
        });

        // Update local cards state to reflect hits/misses immediately
        setCards(prev => prev.map(c => 
          c.id === card.id ? { 
            ...c, 
            hits: (c.hits || 0) + (isHit ? 1 : 0), 
            misses: (c.misses || 0) + (isHit ? 0 : 1) 
          } : c
        ));

        const newCalculatedDays: Record<string, number> = {};
        Object.keys(SLOT_QUOTAS).forEach(label => {
          const { days } = findNextAvailableSlot(card, label, cards);
          newCalculatedDays[label] = days;
        });
        setCalculatedDays(newCalculatedDays);
        setStep(2);
      } else {
        const errorMsg = res.error || 'Erro ao registrar resposta';
        const details = res.details ? `\nDetalhes: ${res.details}` : '';
        const suggestion = res.suggestion ? `\n\nSugestão: ${res.suggestion}` : '';
        
        if (res.details?.includes('column') || res.message?.includes('column') || res.error?.includes('Sincronização')) {
          setShowSqlModal(true);
        } else {
          console.log(`${errorMsg}${details}${suggestion}`);
        }
      }
    } catch (error) {
      console.error("Error in handleAnswer:", error);
    }
  };

  const classify = async (label: string) => {
    const card = currentSession[currentIndex];
    if (!today || !card) return;
    
    const { days, reviewDate } = findNextAvailableSlot(card, label, cards);

    // Update local state immediately to prevent slot double-booking in same session
    const prevClass = card.prev_classificacao || card.ultima_classificacao;
    const prevReviewDate = card.prev_review_date || card.review_date;
    
    setCards(prev => prev.map(c => 
      c.id === card.id ? { 
        ...c, 
        review_date: reviewDate, 
        ultima_classificacao: label, 
        ultima_resposta: today,
        prev_classificacao: prevClass,
        prev_review_date: prevReviewDate
      } : c
    ));

    // Persist to localStorage to survive refreshes and maintain stable slots
    if (typeof window !== 'undefined' && today) {
      const savedMap = localStorage.getItem(`daily_state_map_${today}`);
      const map = savedMap ? JSON.parse(savedMap) : {};
      map[card.id] = { class: prevClass, reviewDate: prevReviewDate };
      localStorage.setItem(`daily_state_map_${today}`, JSON.stringify(map));
    }

    await fetch('/api/save-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        id: card.id, 
        reviewDate, 
        daysInterval: days, 
        ultimaClassificacao: label,
        tableName: card.tableName
      })
    });

    continueSession();
  };

  const getDaysAgo = (dateStr: string | null) => {
    if (!dateStr || !today) return null;
    const diff = new Date(today).getTime() - new Date(dateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const finishSession = async () => {
    let duration = 0;
    if (sessionStartTime) {
      duration = Math.floor((Date.now() - sessionStartTime) / 1000);
      setSessionDuration(duration);
      setSessionStartTime(null);
    }

    try {
      await fetch('/api/save-stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          materia: selectedMateria || 'Todas',
          newHits: sessionStats.newHits,
          newMisses: sessionStats.newMisses,
          reviewHits: sessionStats.reviewHits + sessionStats.overdueHits,
          reviewMisses: sessionStats.reviewMisses + sessionStats.overdueMisses,
          duration: duration
        })
      });
      fetchStats();
    } catch (error) {
      console.error("Error saving stats:", error);
    }
    setView('end');
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
  };

  const calcPct = (hits: number, misses: number) => {
    const total = hits + misses;
    if (total === 0) return '0%';
    return Math.round((hits / total) * 100) + '%';
  };

  const getPctColor = (hits: number, misses: number) => {
    const total = hits + misses;
    if (total === 0) return 'text-black';
    const pct = Math.round((hits / total) * 100);
    if (pct >= 80) return 'text-emerald-600';
    if (pct >= 70) return 'text-yellow-500';
    if (pct >= 60) return 'text-red-600';
    return 'text-black';
  };

  const aggregatedHistoryStats = useMemo(() => {
    const aggregated: Record<string, Record<string, any>> = {};
    
    historyStats.forEach(stat => {
      const d = new Date(stat.created_at);
      const offsetDate = new Date(d.getTime() - (8 * 60 * 60 * 1000));
      const dateStr = offsetDate.toISOString().split('T')[0];
      const materia = stat.materia;
      
      if (!aggregated[dateStr]) aggregated[dateStr] = {};
      if (!aggregated[dateStr][materia]) {
        aggregated[dateStr][materia] = {
          materia,
          created_at: stat.created_at,
          new_hits: 0,
          new_misses: 0,
          review_hits: 0,
          review_misses: 0,
          duration: 0
        };
      }
      
      const item = aggregated[dateStr][materia];
      item.new_hits += stat.new_hits;
      item.new_misses += stat.new_misses;
      item.review_hits += stat.review_hits;
      item.review_misses += stat.review_misses;
      item.duration += stat.duration;
      
      if (new Date(stat.created_at) > new Date(item.created_at)) {
        item.created_at = stat.created_at;
      }
    });
    
    const flattened = Object.entries(aggregated).flatMap(([date, materias]) => 
      Object.values(materias)
    );
    
    return flattened
      .filter(stat => {
        const d = new Date(stat.created_at);
        const offsetDate = new Date(d.getTime() - (8 * 60 * 60 * 1000));
        const statDate = offsetDate.toISOString().split('T')[0];
        const threeDaysAgo = new Date(today);
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        const threeDaysAgoStr = threeDaysAgo.toISOString().split('T')[0];
        return statDate >= threeDaysAgoStr;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [historyStats, today]);

  const continueSession = () => {
    if (mode === "single" && savedSession) {
      setCurrentSession(savedSession.list);
      setCurrentIndex(savedSession.index + 1);
      setMode("session");
      setSavedSession(null);
      
      if (savedSession.index + 1 < savedSession.list.length) {
        setStep(1);
        setLastResult(null);
        setSummary(null);
      } else {
        finishSession();
      }
      return;
    }

    if (currentIndex + 1 < currentSession.length) {
      setCurrentIndex(prev => prev + 1);
      setStep(1);
      setLastResult(null);
      setSummary(null);
    } else {
      finishSession();
    }
  };

  const interruptSession = () => {
    if (selectedMateria && mode === "session") {
      const remaining = currentSession.slice(currentIndex);
      if (remaining.length > 0) {
        setInterruptedSessions(prev => ({
          ...prev,
          [selectedMateria]: remaining
        }));
      }
    }
    finishSession();
  };

  const deleteCard = async (id: string, tableName: string) => {
    try {
      const res = await fetch('/api/delete-card', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, tableName })
        });
        const data = await res.json();
        if (data.ok) {
          await fetchData();
          console.log('Card excluído com sucesso!');
        } else {
          console.log('Erro ao excluir card: ' + (data.error || 'Erro desconhecido'));
        }
      } catch (error) {
        console.error('Error deleting card:', error);
        console.log('Erro de conexão ao tentar excluir o card.');
      }
  };

  const clearDeck = async () => {
    try {
      const res = await fetch('/api/clear-deck', { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          await fetchData();
          console.log('Deck limpo com sucesso!');
        } else {
          console.log('Erro ao limpar deck: ' + (data.error || 'Erro desconhecido'));
        }
      } catch (error) {
        console.error('Error clearing deck:', error);
        console.log('Erro de conexão ao tentar limpar o deck.');
      }
  };

  const handleEdit = (card: Card) => {
    setEditingCard({ ...card });
    setIsEditing(true);
  };

  const saveEdit = async () => {
    if (!editingCard) return;
    try {
      const res = await fetch('/api/save-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCard.id,
          tableName: editingCard.tableName,
          question: editingCard.question,
          correct: editingCard.correct,
          fundamento: editingCard.fundamento
        })
      });
      if (res.ok) {
        setIsEditing(false);
        setEditingCard(null);
        fetchData();
        if (view === 'study') {
          setCurrentSession(prev => prev.map(c => c.id === editingCard.id ? { ...c, ...editingCard } : c));
        }
      }
    } catch (error) {
      console.error("Error saving edit:", error);
    }
  };

  const addCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const tableName = newCard.materia; // Now newCard.materia will hold the table name
    await fetch('/api/add-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newCard, tableName })
    });
    setNewCard({ materia: '', question: '', correct: 'Certo', fundamento: '' });
    fetchData();
    setView('home');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans selection:bg-indigo-100">
      <div className="max-w-3xl mx-auto px-6 py-12">
        
        {/* Header */}
        <header className="mb-12 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {view !== 'home' && (
              <button 
                onClick={() => setView('home')}
                className="p-3 bg-white border border-zinc-200 rounded-2xl shadow-sm hover:shadow-md transition-all text-zinc-400 hover:text-indigo-600"
                title="Voltar ao Início"
              >
                <Home className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="text-4xl font-bold tracking-tight mb-2 flex items-center gap-3">
                <Brain className="w-10 h-10 text-indigo-600" />
                Cards para Concurso - MatheusT
              </h1>
              {view === 'home' && (
                <>
                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-zinc-500 font-medium text-sm">
                    <span className="bg-zinc-100 px-2 py-0.5 rounded-lg">{deckStats.total} total</span>
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg">{deckStats.newCards} inéditas</span>
                    <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-lg">{deckStats.dueCards} devidas hoje</span>
                    <span className="bg-rose-50 text-rose-700 px-2 py-0.5 rounded-lg">{deckStats.overdueCards} atrasadas</span>
                  </div>

                  {/* Table Breakdown */}
                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {tableStats.map(stat => (
                      <div key={stat.table} className="bg-white p-4 rounded-2xl border border-zinc-100 shadow-sm hover:border-indigo-100 transition-all">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 border-b border-zinc-50 pb-1">
                          {TABLE_DISPLAY_NAMES[stat.table] || stat.table.replace('_', ' ')}
                        </p>
                        <div className="flex flex-col gap-1 text-[11px] font-semibold">
                          <div className="flex justify-between items-center">
                            <span className="text-zinc-500">Total</span>
                            <span className="text-zinc-800">{stat.total}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-blue-600">Inéditas</span>
                            <span className="text-blue-700">{stat.newCards}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-amber-600">Devidas</span>
                            <span className="text-amber-700">{stat.dueCards}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-rose-600">Atrasadas</span>
                            <span className="text-rose-700">{stat.overdueCards}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <button 
            onClick={() => setView('add')}
            className="p-3 bg-white border border-zinc-200 rounded-2xl shadow-sm hover:shadow-md transition-all text-zinc-600 hover:text-indigo-600"
            title="Adicionar Novo Card"
          >
            <Plus className="w-6 h-6" />
          </button>
        </header>
        
        {generalError && (
          <div className="mb-8 p-6 bg-rose-50 border border-rose-200 rounded-3xl flex items-start gap-4 text-rose-800">
            <div className="p-2 bg-rose-100 rounded-xl">
              <XCircle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="font-bold mb-1">Erro no Banco de Dados</h3>
              <p className="text-sm opacity-90 leading-relaxed">
                {generalError}
              </p>
            </div>
          </div>
        )}

        {!isSupabaseConfigured && (
          <div className="mb-8 p-6 bg-amber-50 border border-amber-200 rounded-3xl flex items-start gap-4 text-amber-800">
            <div className="p-2 bg-amber-100 rounded-xl">
              <XCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-bold mb-1">Supabase não configurado</h3>
              <p className="text-sm opacity-90 leading-relaxed">
                As credenciais do Supabase estão faltando. Por favor, configure as variáveis 
                <code className="mx-1 px-1 bg-amber-100 rounded">SUPABASE_URL</code> e 
                <code className="mx-1 px-1 bg-amber-100 rounded">SUPABASE_ANON_KEY</code> 
                no seu projeto Vercel para que o banco de dados funcione.
              </p>
            </div>
          </div>
        )}

        <div className="main-content">
          {view === 'home' && (
            <div 
              key="home"
              className="space-y-8"
            >
              {/* Session Config */}
              <section className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-100">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Play className="w-5 h-5 text-indigo-500" />
                  Nova Sessão
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Inéditas</label>
                    <input 
                      type="number" 
                      value={config.numNew}
                      onChange={e => setConfig({ ...config, numNew: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Devidas</label>
                    <input 
                      type="number" 
                      value={config.numReview}
                      onChange={e => setConfig({ ...config, numReview: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-amber-500 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Atrasadas</label>
                    <input 
                      type="number" 
                      value={config.numOverdue}
                      onChange={e => setConfig({ ...config, numOverdue: parseInt(e.target.value) || 0 })}
                      className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-rose-500 transition-all font-medium"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TABLES.map(t => {
                    const isCompleted = completedTables[t];
                    const hasInterrupted = !!interruptedSessions[t];
                    
                    return (
                      <button 
                        key={t}
                        onClick={() => startSession(t)}
                        className={`py-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1 shadow-md ${
                          isCompleted 
                            ? 'bg-emerald-600 text-white shadow-emerald-100 hover:bg-emerald-700' 
                            : 'bg-indigo-600 text-white shadow-indigo-100 hover:bg-indigo-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Play className="w-4 h-4" />
                          {TABLE_DISPLAY_NAMES[t] || t.replace('_', ' ').toUpperCase()}
                        </div>
                        {hasInterrupted && (
                          <span className="text-[9px] opacity-80 font-medium">Retomar ({interruptedSessions[t].length} cards)</span>
                        )}
                        {isCompleted && (
                          <span className="text-[9px] opacity-80 font-medium">Meta Diária Batida!</span>
                        )}
                      </button>
                    );
                  })}
                  <button 
                    onClick={() => startSession()}
                    className="py-4 bg-zinc-800 text-white rounded-2xl font-bold text-sm hover:bg-zinc-900 shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 sm:col-span-2"
                  >
                    <Database className="w-4 h-4" />
                    Todas as Tabelas
                  </button>
                </div>
              </section>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-zinc-100 flex items-center justify-between group cursor-pointer hover:border-indigo-200 transition-all">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-50 rounded-2xl text-zinc-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all">
                      <Search className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold">Buscar ID</h3>
                      <p className="text-[10px] text-zinc-400">Ver histórico do card</p>
                    </div>
                  </div>
                  <input 
                    placeholder="ID..."
                    onKeyDown={e => e.key === 'Enter' && showCardInfo((e.target as HTMLInputElement).value)}
                    className="w-16 p-2 bg-zinc-50 rounded-xl text-xs focus:w-24 transition-all outline-none border-none"
                  />
                </div>
                
                <button 
                  onClick={() => setView('database')}
                  className="bg-white p-6 rounded-3xl border border-zinc-100 flex items-center gap-4 group hover:border-indigo-200 transition-all"
                >
                  <div className="p-3 bg-zinc-50 rounded-2xl text-zinc-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold">Ver Deck</h3>
                    <p className="text-[10px] text-zinc-400">Lista de IDs</p>
                  </div>
                </button>

                <button 
                  onClick={() => setView('calendar')}
                  className="bg-white p-6 rounded-3xl border border-zinc-100 flex items-center gap-4 group hover:border-indigo-200 transition-all"
                >
                  <div className="p-3 bg-zinc-50 rounded-2xl text-zinc-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold">Calendário</h3>
                    <p className="text-[10px] text-zinc-400">Revisões previstas</p>
                  </div>
                </button>

                <button 
                  onClick={() => setView('stats')}
                  className="bg-white p-6 rounded-3xl border border-zinc-100 flex items-center gap-4 group hover:border-indigo-200 transition-all"
                >
                  <div className="p-3 bg-zinc-50 rounded-2xl text-zinc-400 group-hover:text-indigo-500 group-hover:bg-indigo-50 transition-all">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold">Histórico</h3>
                    <p className="text-[10px] text-zinc-400">Últimos 3 dias</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {view === 'study' && currentSession[currentIndex] && (
            <div 
              key="study"
              className="space-y-6"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setView('home')}
                    className="p-2 hover:bg-zinc-100 rounded-xl transition-all text-zinc-400 hover:text-indigo-600"
                    title="Sair da Sessão"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="flex gap-2">
                    <span className="px-3 py-1 bg-zinc-900 text-white text-[10px] font-bold uppercase tracking-widest rounded-full">
                      {currentSession[currentIndex].id}
                    </span>
                    {currentSession[currentIndex].materia && (
                      <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-widest rounded-full">
                        {currentSession[currentIndex].materia}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                    Card {currentIndex + 1} de {currentSession.length}
                  </p>
                  {mode === "session" && (
                    <button 
                      onClick={interruptSession}
                      className="px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-bold uppercase tracking-widest rounded-full hover:bg-rose-100 transition-all"
                    >
                      Encerrar Sessão
                    </button>
                  )}
                </div>
              </div>

              {/* Card Content */}
              <div className={`p-10 rounded-[2.5rem] shadow-xl shadow-zinc-200/50 border border-zinc-100 min-h-[400px] flex flex-col ${
                currentSession[currentIndex].review_date && currentSession[currentIndex].review_date < today 
                  ? 'bg-rose-50/50 border-rose-100' 
                  : 'bg-white'
              }`}>
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-zinc-400">
                        <BookOpen className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Questão</span>
                      </div>
                      {currentSession[currentIndex].review_date && currentSession[currentIndex].review_date < today && (
                        <div className="flex items-center gap-2 text-rose-500 bg-rose-50 px-2 py-1 rounded-md border border-rose-100">
                          <Clock className="w-3 h-3" />
                          <span className="text-[9px] font-bold uppercase tracking-widest">Atrasada: {new Date(currentSession[currentIndex].review_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                    </div>
                    {step >= 2 && currentSession[currentIndex].ultima_classificacao && (
                      <div className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 ${
                        RANGES[currentSession[currentIndex].ultima_classificacao]?.color || 'bg-zinc-100 text-zinc-400'
                      } ${
                        ['Errei', 'Errei Outra Vez', 'Acertei com Dúvida', 'Acertei'].includes(currentSession[currentIndex].ultima_classificacao) ? 'text-white' : 'text-zinc-800'
                      }`}>
                        <span>Última: {currentSession[currentIndex].ultima_classificacao}</span>
                        <span>•</span>
                        <span>{currentSession[currentIndex].ultima_resposta ? new Date(currentSession[currentIndex].ultima_resposta + 'T12:00:00').toLocaleDateString('pt-BR') : ''} ({getDaysAgo(currentSession[currentIndex].ultima_resposta)} dias atrás)</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-start justify-between mb-4 gap-4">
                    <p className="text-xl font-medium leading-relaxed whitespace-pre-wrap text-justify flex-1">
                      {currentSession[currentIndex].question}
                    </p>
                    {step >= 2 && (
                      <button 
                        onClick={() => handleEdit(currentSession[currentIndex])}
                        className="p-2 text-zinc-300 hover:text-indigo-600 transition-all shrink-0"
                        title="Editar questão"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="study-feedback">
                  {step >= 2 && (
                    <div 
                      className="mt-auto pt-8 border-t border-zinc-100"
                    >
                      {step === 2 && (
                        <div className="result-container">
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2 text-zinc-400">
                              <CheckCircle2 className="w-4 h-4" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Gabarito</span>
                            </div>
                            <span className={`text-2xl font-black italic uppercase tracking-tighter ${currentSession[currentIndex].correct === 'Certo' ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {currentSession[currentIndex].correct}
                            </span>
                          </div>

                          {lastResult && (
                            <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 font-bold ${lastResult.isHit ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                              {lastResult.isHit ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                              Você {lastResult.isHit ? 'ACERTOU' : 'ERROU'} agora
                            </div>
                          )}

                          {currentSession[currentIndex].fundamento && (
                            <div className="bg-zinc-50 p-6 rounded-3xl">
                              <p className={`text-lg leading-relaxed italic font-medium text-justify whitespace-pre-wrap ${currentSession[currentIndex].correct === 'Errado' ? 'text-rose-600' : 'text-blue-600'}`}>
                                {currentSession[currentIndex].fundamento}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Controls */}
              <div className="mt-8">
                {step === 1 && (
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => handleAnswer('Certo')}
                      className="py-6 bg-emerald-500 text-white rounded-3xl font-bold text-xl hover:bg-emerald-600 shadow-lg shadow-emerald-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                      <CheckCircle2 className="w-6 h-6" />
                      Certo
                    </button>
                    <button 
                      onClick={() => handleAnswer('Errado')}
                      className="py-6 bg-rose-500 text-white rounded-3xl font-bold text-xl hover:bg-rose-600 shadow-lg shadow-rose-100 transition-all active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                      <XCircle className="w-6 h-6" />
                      Errado
                    </button>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-4">
                    {currentSession[currentIndex].ultima_classificacao && (
                      <p className="text-center text-[10px] font-bold uppercase tracking-widest mb-2">
                        <span className="text-zinc-400">Resposta Anterior: </span>
                        <span className={`px-2 py-0.5 rounded-md ${RANGES[currentSession[currentIndex].ultima_classificacao]?.color || 'bg-zinc-100'} ${['Errei', 'Errei Outra Vez', 'Acertei com Dúvida', 'Acertei'].includes(currentSession[currentIndex].ultima_classificacao) ? 'text-white' : 'text-zinc-800'}`}>
                          {currentSession[currentIndex].ultima_classificacao}
                        </span>
                        {currentSession[currentIndex].ultima_resposta && (
                          <span className="ml-2 text-zinc-400">em {new Date(currentSession[currentIndex].ultima_resposta + 'T12:00:00').toLocaleDateString('pt-BR')}</span>
                        )}
                      </p>
                    )}
                    {currentSession[currentIndex].review_date && currentSession[currentIndex].review_date < today && (
                      <p className="text-center text-[10px] font-bold uppercase tracking-widest mb-2">
                        <span className="text-rose-400">Deveria ter sido respondida em: </span>
                        <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                          {new Date(currentSession[currentIndex].review_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      </p>
                    )}
                    <p className="text-center text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Classifique sua resposta</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {Object.keys(RANGES)
                        .filter(label => {
                          const card = currentSession[currentIndex];
                          const prev = card.ultima_classificacao;
                          const isNew = !card.review_date;
                          const wasMiss = prev === 'Errei' || prev === 'Errei Outra Vez';
                          
                          if (lastResult?.isHit) {
                            if (RANGES[label].type !== 'hit') return false;
                            
                            // 1. Inéditas
                            if (isNew) {
                              return ['Acertei', 'Acertei Chutando', 'Acertei com Dúvida'].includes(label);
                            }
                            
                            // 2. Devida/Atrasada + Prev Errei/Errei Outra Vez
                            if (wasMiss) {
                              return label === 'Acertei 2ª Chance';
                            }
                            
                            // 3. Prev Acertei 2ª Chance
                            if (prev === 'Acertei 2ª Chance') {
                              return label === 'Acertei Chutando';
                            }
                            
                            // 4. Prev Acertei Chutando
                            if (prev === 'Acertei Chutando') {
                              return ['Acertei Chutando', 'Acertei com Dúvida'].includes(label);
                            }
                            
                            // 5. Prev Acertei com Dúvida
                            if (prev === 'Acertei com Dúvida') {
                              return ['Acertei Chutando', 'Acertei com Dúvida', 'Acertei'].includes(label);
                            }
                            
                            // 6. Prev Acertei ou Acertei Tranquilo
                            if (prev === 'Acertei' || prev === 'Acertei Tranquilo') {
                              return ['Acertei Chutando', 'Acertei com Dúvida', 'Acertei', 'Acertei Tranquilo'].includes(label);
                            }
                            
                            return false;
                          } else {
                            if (RANGES[label].type !== 'miss') return false;
                            
                            // Inéditas
                            if (isNew) return label === 'Errei';
                            
                            // Devida/Atrasada + Prev Errei/Errei Outra Vez
                            if (wasMiss) return label === 'Errei Outra Vez';
                            
                            // Fallback para erros em revisão
                            return label === 'Errei';
                          }
                        })
                        .map((label) => (
                        <button 
                          key={label}
                          onClick={() => classify(label)}
                          className={`py-4 ${RANGES[label].color} ${['Errei', 'Errei Outra Vez', 'Acertei com Dúvida', 'Acertei'].includes(label) ? 'text-white' : 'text-zinc-800'} rounded-2xl font-bold text-[11px] hover:opacity-90 transition-all shadow-md leading-tight flex flex-col items-center justify-center`}
                        >
                          <span>{label}</span>
                          <span className="text-[9px] opacity-70 mt-1">{calculatedDays[label]} dias</span>
                        </button>
                      ))}
                      <button 
                        onClick={() => {
                          if (confirm('Tem certeza que deseja excluir este card permanentemente?')) {
                            deleteCard(currentSession[currentIndex].id, currentSession[currentIndex].tableName);
                            continueSession();
                          }
                        }}
                        className="py-4 bg-rose-50 text-rose-600 border border-rose-100 rounded-2xl font-bold text-[11px] hover:bg-rose-100 transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </button>
                    </div>
                    <button 
                      onClick={() => setStep(1)}
                      className="w-full py-4 text-zinc-400 font-bold text-sm hover:text-zinc-600 transition-all"
                    >
                      Voltar
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === 'end' && (
            <div 
              key="end"
              className="text-center py-12"
            >
              <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Sessão Concluída!</h2>
              
              {sessionDuration > 0 && (
                <div className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-2xl font-bold text-lg shadow-sm border border-indigo-100">
                  <Clock className="w-5 h-5 text-indigo-500" />
                  Tempo Total: {formatDuration(sessionDuration)}
                </div>
              )}

              <div className="bg-white p-8 rounded-[2rem] border border-zinc-100 shadow-sm mb-8 max-w-md mx-auto">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-6">Resumo Estatístico</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-start">
                      <span className="text-zinc-600 font-medium">Inéditas</span>
                      <span className={`text-[10px] font-bold ${getPctColor(sessionStats.newHits, sessionStats.newMisses)}`}>{calcPct(sessionStats.newHits, sessionStats.newMisses)} de acerto</span>
                    </div>
                    <div className="flex gap-4">
                      <span className={`${(sessionStats.newHits + sessionStats.newMisses) > 0 ? 'text-emerald-600' : 'text-black'} font-bold`}>{sessionStats.newHits} acertos</span>
                      <span className={`${(sessionStats.newHits + sessionStats.newMisses) > 0 ? 'text-rose-600' : 'text-black'} font-bold`}>{sessionStats.newMisses} erros</span>
                    </div>
                  </div>
                  <div className="h-px bg-zinc-100 w-full" />
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col items-start">
                      <span className="text-zinc-600 font-medium">Revisões</span>
                      <span className={`text-[10px] font-bold ${getPctColor(sessionStats.reviewHits + sessionStats.overdueHits, sessionStats.reviewMisses + sessionStats.overdueMisses)}`}>{calcPct(sessionStats.reviewHits + sessionStats.overdueHits, sessionStats.reviewMisses + sessionStats.overdueMisses)} de acerto</span>
                    </div>
                    <div className="flex gap-4">
                      <span className={`${(sessionStats.reviewHits + sessionStats.overdueHits + sessionStats.reviewMisses + sessionStats.overdueMisses) > 0 ? 'text-emerald-600' : 'text-black'} font-bold`}>{sessionStats.reviewHits + sessionStats.overdueHits} acertos</span>
                      <span className={`${(sessionStats.reviewHits + sessionStats.overdueHits + sessionStats.reviewMisses + sessionStats.overdueMisses) > 0 ? 'text-rose-600' : 'text-black'} font-bold`}>{sessionStats.reviewMisses + sessionStats.overdueMisses} erros</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-4 max-w-xs mx-auto">
                <button 
                  onClick={() => { setView('home'); fetchData(); }}
                  className="py-5 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  <Home className="w-5 h-5" />
                  Voltar ao Início
                </button>
                <button 
                  onClick={() => startSession()}
                  className="py-5 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" />
                  Repetir Sessão
                </button>
              </div>
            </div>
          )}

          {view === 'stats' && (
            <div 
              key="stats"
              className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-100"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setView('home')} className="p-2 hover:bg-zinc-50 rounded-xl transition-all text-zinc-400 hover:text-indigo-600">
                  <Home className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold">Histórico (3 Dias)</h2>
              </div>

              <div className="space-y-6 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {aggregatedHistoryStats.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 italic">Nenhuma estatística registrada recentemente.</div>
                ) : (
                  aggregatedHistoryStats.map((stat, idx) => (
                    <div key={idx} className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h3 className="font-bold text-lg">{(TABLE_DISPLAY_NAMES[stat.materia] || stat.materia.replace('_', ' ')).toUpperCase()}</h3>
                          <p className="text-xs text-zinc-400 uppercase font-bold tracking-widest flex items-center gap-2">
                            {new Date(new Date(stat.created_at).getTime() - (8 * 60 * 60 * 1000)).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', timeZone: 'UTC' })}
                            {stat.duration > 0 && (
                              <>
                                <span>•</span>
                                <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md text-[10px]">
                                  Tempo: {formatDuration(stat.duration)}
                                </span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-zinc-100">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">Inéditas</p>
                            <span className={`text-[10px] font-bold ${getPctColor(stat.new_hits, stat.new_misses)}`}>{calcPct(stat.new_hits, stat.new_misses)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${(stat.new_hits + stat.new_misses) > 0 ? 'text-emerald-600' : 'text-black'} font-bold`}>{stat.new_hits} acertos</span>
                            <span className={`${(stat.new_hits + stat.new_misses) > 0 ? 'text-rose-600' : 'text-black'} font-bold`}>{stat.new_misses} erros</span>
                          </div>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-zinc-100">
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-[10px] font-bold text-zinc-400 uppercase">Devidas</p>
                            <span className={`text-[10px] font-bold ${getPctColor(stat.review_hits, stat.review_misses)}`}>{calcPct(stat.review_hits, stat.review_misses)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className={`${(stat.review_hits + stat.review_misses) > 0 ? 'text-emerald-600' : 'text-black'} font-bold`}>{stat.review_hits} acertos</span>
                            <span className={`${(stat.review_hits + stat.review_misses) > 0 ? 'text-rose-600' : 'text-black'} font-bold`}>{stat.review_misses} erros</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {view === 'calendar' && (
            <div 
              key="calendar"
              className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-100"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setView('home')} className="p-2 hover:bg-zinc-50 rounded-xl transition-all text-zinc-400 hover:text-indigo-600">
                  <Home className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold">Calendário de Revisões</h2>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {calendarData.overdue && (
                  <div className="p-6 bg-rose-50 rounded-2xl border border-rose-100 flex items-center justify-between group hover:border-rose-200 transition-all mb-4">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-rose-100 text-rose-600">
                        <Clock className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg text-rose-700">Atrasadas (Total)</h3>
                        <p className="text-xs text-rose-400 uppercase font-bold tracking-widest mb-2">
                          Cards que ficaram para trás
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(calendarData.overdue.subjects).map(([subject, count]) => (
                            <span key={subject} className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-rose-100 text-rose-500 font-bold uppercase tracking-tight">
                              {TABLE_DISPLAY_NAMES[subject] || subject.replace('_', ' ')}: {count}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-rose-600">{calendarData.overdue.total}</p>
                      <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest">Cards</p>
                    </div>
                  </div>
                )}

                {calendarData.upcoming.length === 0 && !calendarData.overdue ? (
                  <div className="text-center py-12 text-zinc-400 italic">Nenhuma revisão prevista.</div>
                ) : (
                  calendarData.upcoming.map(([date, info]) => (
                    <div key={date} className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${date < today ? 'bg-rose-100 text-rose-600' : date === today ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
                          <Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' })}</h3>
                          <p className="text-xs text-zinc-400 uppercase font-bold tracking-widest mb-2">
                            {date === today ? 'Hoje' : date < today ? 'Atrasada' : 'Futuro'}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {Object.entries(info.subjects).map(([subject, count]) => (
                              <span key={subject} className="text-[10px] bg-white px-2 py-0.5 rounded-md border border-zinc-100 text-zinc-500 font-bold uppercase tracking-tight">
                                {TABLE_DISPLAY_NAMES[subject] || subject.replace('_', ' ')}: {count}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-indigo-600">{info.total}</p>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Cards</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {view === 'database' && (
            <div 
              key="database"
              className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-100"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <button onClick={() => setView('home')} className="p-2 hover:bg-zinc-50 rounded-xl transition-all text-zinc-400 hover:text-indigo-600">
                    <Home className="w-6 h-6" />
                  </button>
                  <h2 className="text-2xl font-bold">Base de Dados</h2>
                  <button onClick={fetchData} className="p-2 hover:bg-zinc-50 rounded-xl transition-all ml-2 text-zinc-400 hover:text-indigo-600">
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">{cards.length} cards</p>
              </div>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {cards.length === 0 ? (
                  <div className="text-center py-12 text-zinc-400 italic">Nenhum card cadastrado.</div>
                ) : (
                  cards.map(card => (
                    <div key={card.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between group hover:border-indigo-200 transition-all">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-zinc-900 text-white text-[9px] font-bold rounded-md">{card.id}</span>
                          <span className="text-[10px] font-bold text-indigo-600 uppercase truncate">{TABLE_DISPLAY_NAMES[card.tableName] || card.tableName.replace('_', ' ')}</span>
                        </div>
                        <p className="text-sm text-zinc-600 truncate">{card.question}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => showCardInfo(card.id)}
                          className="p-2 bg-white rounded-xl shadow-sm text-zinc-400 hover:text-indigo-600 transition-all border border-zinc-100"
                          title="Ver histórico"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => startById(card.id)}
                          className="p-2 bg-white rounded-xl shadow-sm text-zinc-400 hover:text-indigo-600 transition-all"
                          title="Estudar este card"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteCard(card.id, card.tableName);
                          }}
                          className="p-2 bg-white rounded-xl shadow-sm text-zinc-400 hover:text-red-600 transition-all border border-zinc-100"
                          title="Excluir este card"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {view === 'add' && (
            <div 
              key="add"
              className="bg-white p-8 rounded-[2rem] shadow-sm border border-zinc-100"
            >
              <div className="flex items-center gap-4 mb-8">
                <button onClick={() => setView('home')} className="p-2 hover:bg-zinc-50 rounded-xl transition-all text-zinc-400 hover:text-indigo-600">
                  <Home className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold">Novo Card</h2>
              </div>
              <form onSubmit={addCard} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Matéria</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {TABLES.map(t => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setNewCard({ ...newCard, materia: t })}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all ${newCard.materia === t ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-400 hover:bg-zinc-200'}`}
                      >
                        {TABLE_DISPLAY_NAMES[t] || t.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                  <input 
                    required
                    value={newCard.materia}
                    onChange={e => setNewCard({ ...newCard, materia: e.target.value })}
                    className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Ou digite outra matéria..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Questão</label>
                  <textarea 
                    required
                    value={newCard.question}
                    onChange={e => setNewCard({ ...newCard, question: e.target.value })}
                    className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px]"
                    placeholder="Digite a pergunta..."
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Gabarito</label>
                  <div className="flex gap-4">
                    {['Certo', 'Errado'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setNewCard({ ...newCard, correct: opt })}
                        className={`flex-1 py-4 rounded-2xl font-bold transition-all ${newCard.correct === opt ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-zinc-50 text-zinc-400'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Fundamento (Opcional)</label>
                  <textarea 
                    value={newCard.fundamento}
                    onChange={e => setNewCard({ ...newCard, fundamento: e.target.value })}
                    className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
                    placeholder="Explicação da resposta..."
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Salvar Card
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer Stats */}
        {view === 'home' && (
          <footer className="mt-12">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Desempenho de Hoje ({today ? new Date(today + 'T00:00:00').toLocaleDateString('pt-BR') : ''})</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-zinc-100 text-center">
                <BarChart3 className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                <p className={`text-2xl font-black ${getPctColor(todayStats.hits, todayStats.misses)}`}>{calcPct(todayStats.hits, todayStats.misses)}</p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Acerto</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-zinc-100 text-center">
                <div className="flex justify-center gap-2 mb-2">
                   <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                   <XCircle className="w-5 h-5 text-rose-500" />
                </div>
                <p className="text-xl font-black">
                  <span className={`${(todayStats.hits + todayStats.misses) > 0 ? 'text-emerald-600' : 'text-black'}`}>{todayStats.hits}</span>
                  <span className="text-zinc-300 mx-1">/</span>
                  <span className={`${(todayStats.hits + todayStats.misses) > 0 ? 'text-rose-600' : 'text-black'}`}>{todayStats.misses}</span>
                </p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Acertos / Erros</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-zinc-100 text-center">
                <Clock className="w-5 h-5 text-indigo-500 mx-auto mb-2" />
                <p className="text-2xl font-black">{formatDuration(todayStats.duration)}</p>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Tempo Total</p>
              </div>
            </div>

            {/* Full History Stats */}
            {fullHistoryStats && (
              <div className="mt-12 pt-12 border-t border-zinc-100">
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Histórico Completo (Desde o Início)</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-[2rem] border border-zinc-100 shadow-sm">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <BarChart3 className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">Desempenho Global</h4>
                        <p className="text-xs text-zinc-400">Total de {fullHistoryStats.global.totalHits + fullHistoryStats.global.totalMisses} tentativas em {fullHistoryStats.global.uniqueAnswered} questões inéditas</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-end">
                        <div>
                          <p className={`text-3xl font-black ${getPctColor(fullHistoryStats.global.totalHits, fullHistoryStats.global.totalMisses)}`}>{calcPct(fullHistoryStats.global.totalHits, fullHistoryStats.global.totalMisses)}</p>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Aproveitamento Total</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">
                            <span className={`${(fullHistoryStats.global.totalHits + fullHistoryStats.global.totalMisses) > 0 ? 'text-emerald-600' : 'text-black'}`}>{fullHistoryStats.global.totalHits} acertos</span>
                            <span className="text-zinc-300 mx-2">/</span>
                            <span className={`${(fullHistoryStats.global.totalHits + fullHistoryStats.global.totalMisses) > 0 ? 'text-rose-600' : 'text-black'}`}>{fullHistoryStats.global.totalMisses} erros</span>
                          </p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-50">
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Questões Inéditas</p>
                          <p className="text-sm font-bold text-zinc-800">
                            <span className="text-indigo-600">{fullHistoryStats.global.uniqueAnswered}</span>
                            <span className="text-[10px] text-zinc-400 font-normal ml-1">de {cards.length} totais</span>
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-zinc-400 uppercase mb-1">Tempo Total</p>
                          <p className="text-sm font-bold text-zinc-800 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-indigo-500" />
                            {formatDuration(fullHistoryStats.global.totalDuration)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-8 rounded-[2rem] border border-zinc-100 shadow-sm flex flex-col">
                    <h4 className="font-bold mb-4 text-[10px] uppercase tracking-widest text-zinc-400">Por Matéria (Questões Inéditas)</h4>
                    <div className="space-y-3 overflow-y-auto max-h-[200px] pr-2 custom-scrollbar">
                      {Object.entries(fullHistoryStats.statsByMateria).filter(([materia]) => materia !== 'Todas').map(([materia, s]) => (
                        <div key={materia} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100/50">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold truncate uppercase tracking-tight text-zinc-700">{TABLE_DISPLAY_NAMES[materia] || materia.replace('_', ' ')}</p>
                            <div className="flex gap-3 text-[9px] font-bold">
                              <span className="text-indigo-600">Inéditas: {s.uniqueAnswered}</span>
                              <span className={getPctColor(s.totalHits, s.totalMisses)}>Acerto: {calcPct(s.totalHits, s.totalMisses)}</span>
                            </div>
                          </div>
                          <div className="text-right ml-4">
                            <p className={`text-sm font-black ${(s.totalHits + s.totalMisses) > 0 ? 'text-emerald-600' : 'text-black'} leading-none`}>{s.totalHits} ac.</p>
                            <p className="text-[9px] text-zinc-400 font-bold mt-1">{s.totalHits + s.totalMisses} tent.</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </footer>
        )}
      </div>

      {/* SQL Modal */}
      <div className="modals">
        {showSqlModal && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <div 
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Sincronizar Banco</h2>
                    <p className="text-sm text-zinc-500">Atualize a estrutura do seu Supabase</p>
                  </div>
                </div>
                <button onClick={() => setShowSqlModal(false)} className="p-2 hover:bg-zinc-200 rounded-xl transition-all">
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6">
                <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl text-rose-800 text-sm">
                  <p className="font-bold mb-1">O que aconteceu?</p>
                  <p>O Supabase não encontrou as tabelas necessárias ou colunas como <code className="bg-rose-100 px-1 rounded">ultima_resposta</code>. Isso acontece quando a estrutura do banco está desatualizada.</p>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-bold text-zinc-700 uppercase tracking-wider">Como Corrigir:</p>
                  <ol className="text-sm text-zinc-600 space-y-3 list-decimal ml-4">
                    <li>Abra o <strong>SQL Editor</strong> no seu painel do Supabase.</li>
                    <li>Copie o código abaixo (que cria a tabela independente) e cole no editor.</li>
                    <li>Clique em <strong>Run</strong>.</li>
                    <li>Recarregue esta página.</li>
                  </ol>
                </div>

                <div className="relative group">
                  <pre className="bg-zinc-900 text-zinc-300 p-6 rounded-2xl text-xs overflow-x-auto font-mono leading-relaxed">
{`-- SQL para criar a tabela independente
DO $$ 
DECLARE 
    tbl TEXT;
    tables TEXT[] := ARRAY['tjsc'];
BEGIN 
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I (
                id TEXT PRIMARY KEY,
                materia TEXT,
                question TEXT NOT NULL,
                correct TEXT NOT NULL,
                fundamento TEXT,
                review_date TEXT,
                days_interval INTEGER DEFAULT 0,
                hits INTEGER DEFAULT 0,
                misses INTEGER DEFAULT 0,
                ultima_resposta TEXT,
                ultimo_resultado TEXT,
                ultima_classificacao TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            ALTER TABLE %I ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS "Allow all access" ON %I;
            CREATE POLICY "Allow all access" ON %I FOR ALL USING (true) WITH CHECK (true);
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END $$;

-- Tabela de Estatísticas
CREATE TABLE IF NOT EXISTS session_stats (
    id BIGSERIAL PRIMARY KEY,
    materia TEXT,
    new_hits INTEGER DEFAULT 0,
    new_misses INTEGER DEFAULT 0,
    review_hits INTEGER DEFAULT 0,
    review_misses INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE session_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON session_stats;
CREATE POLICY "Allow all access" ON session_stats FOR ALL USING (true) WITH CHECK (true);
`}
                  </pre>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`DO $$ 
DECLARE 
    tbl TEXT;
    tables TEXT[] := ARRAY['tjsc'];
BEGIN 
    FOREACH tbl IN ARRAY tables LOOP
        EXECUTE format('
            CREATE TABLE IF NOT EXISTS %I (
                id TEXT PRIMARY KEY,
                materia TEXT,
                question TEXT NOT NULL,
                correct TEXT NOT NULL,
                fundamento TEXT,
                review_date TEXT,
                days_interval INTEGER DEFAULT 0,
                hits INTEGER DEFAULT 0,
                misses INTEGER DEFAULT 0,
                ultima_resposta TEXT,
                ultimo_resultado TEXT,
                ultima_classificacao TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            );
            ALTER TABLE %I ENABLE ROW LEVEL SECURITY;
            DROP POLICY IF EXISTS "Allow all access" ON %I;
            CREATE POLICY "Allow all access" ON %I FOR ALL USING (true) WITH CHECK (true);
        ', tbl, tbl, tbl, tbl);
    END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS session_stats (
    id BIGSERIAL PRIMARY KEY,
    materia TEXT,
    new_hits INTEGER DEFAULT 0,
    new_misses INTEGER DEFAULT 0,
    review_hits INTEGER DEFAULT 0,
    review_misses INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE session_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access" ON session_stats;
CREATE POLICY "Allow all access" ON session_stats FOR ALL USING (true) WITH CHECK (true);`);
                      console.log('SQL copiado!');
                    }}
                    className="absolute top-4 right-4 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest rounded-lg backdrop-blur-md transition-all opacity-0 group-hover:opacity-100"
                  >
                    Copiar SQL
                  </button>
                </div>
              </div>

              <div className="p-8 bg-zinc-50 border-t border-zinc-100">
                <button 
                  onClick={() => setShowSqlModal(false)}
                  className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all"
                >
                  Entendi, vou atualizar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modals */}
        {selectedCardInfo && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900">Histórico do Card</h2>
                    <p className="text-zinc-500 text-sm font-medium">ID: {selectedCardInfo.id}</p>
                  </div>
                  <button 
                    onClick={() => setSelectedCardInfo(null)}
                    className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-zinc-400" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-zinc-50 p-4 rounded-3xl border border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Respostas</p>
                      <p className="text-2xl font-bold text-zinc-800">{(selectedCardInfo.hits || 0) + (selectedCardInfo.misses || 0)}</p>
                    </div>
                    <div className="bg-zinc-50 p-4 rounded-3xl border border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Aproveitamento</p>
                      <p className={`text-2xl font-bold ${getPctColor(selectedCardInfo.hits || 0, selectedCardInfo.misses || 0)}`}>
                        {calcPct(selectedCardInfo.hits || 0, selectedCardInfo.misses || 0)}
                      </p>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-3xl border border-emerald-100">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-1">Acertos</p>
                      <p className="text-2xl font-bold text-emerald-700">{selectedCardInfo.hits || 0}</p>
                    </div>
                    <div className="bg-rose-50 p-4 rounded-3xl border border-rose-100">
                      <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Erros</p>
                      <p className="text-2xl font-bold text-rose-700">{selectedCardInfo.misses || 0}</p>
                    </div>
                  </div>

                  {/* Last Classification & Last Answer */}
                  <div className="grid grid-cols-1 gap-4">
                    <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
                      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Última Classificação</p>
                      {selectedCardInfo.ultima_classificacao ? (
                        <div className={`inline-flex items-center px-4 py-2 rounded-xl text-white font-bold text-sm shadow-sm ${
                          selectedCardInfo.ultima_classificacao === "Errei" ? "bg-rose-500" :
                          selectedCardInfo.ultima_classificacao === "Errei Outra Vez" ? "bg-zinc-900" :
                          selectedCardInfo.ultima_classificacao === "Acertei 2ª Chance" ? "bg-emerald-100 !text-emerald-700" :
                          selectedCardInfo.ultima_classificacao === "Acertei Chutando" ? "bg-amber-400" :
                          selectedCardInfo.ultima_classificacao === "Acertei com Dúvida" ? "bg-blue-600" :
                          selectedCardInfo.ultima_classificacao === "Acertei" ? "bg-emerald-600" :
                          selectedCardInfo.ultima_classificacao === "Acertei Tranquilo" ? "bg-lime-400" : "bg-zinc-400"
                        }`}>
                          {selectedCardInfo.ultima_classificacao}
                        </div>
                      ) : (
                        <p className="text-zinc-400 text-sm italic">Nunca respondido</p>
                      )}
                    </div>

                    <div className="bg-zinc-50 p-6 rounded-3xl border border-zinc-100 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Última Resposta</p>
                        <p className="text-lg font-bold text-zinc-800">
                          {selectedCardInfo.ultima_resposta 
                            ? new Date(selectedCardInfo.ultima_resposta + 'T12:00:00Z').toLocaleDateString('pt-BR')
                            : 'Nunca respondido'}
                        </p>
                      </div>
                      <Clock className="w-6 h-6 text-zinc-200" />
                    </div>
                  </div>

                  {/* Next Review */}
                  <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest mb-1">Próxima Revisão</p>
                      <p className="text-lg font-bold text-indigo-900">
                        {selectedCardInfo.review_date 
                          ? new Date(selectedCardInfo.review_date + 'T12:00:00Z').toLocaleDateString('pt-BR')
                          : 'Não agendada'}
                      </p>
                    </div>
                    <Calendar className="w-8 h-8 text-indigo-200" />
                  </div>

                  <button 
                    onClick={() => setSelectedCardInfo(null)}
                    className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all active:scale-[0.98]"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isEditing && editingCard && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl">
                    <Pencil className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Editar Card</h2>
                    <p className="text-sm text-zinc-500">ID: {editingCard.id}</p>
                  </div>
                </div>
                <button onClick={() => setIsEditing(false)} className="p-2 hover:bg-zinc-200 rounded-xl transition-all">
                  <X className="w-6 h-6 text-zinc-400" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Questão</label>
                  <textarea 
                    value={editingCard.question}
                    onChange={e => setEditingCard({ ...editingCard, question: e.target.value })}
                    className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Gabarito</label>
                  <div className="flex gap-4">
                    {['Certo', 'Errado'].map(opt => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setEditingCard({ ...editingCard, correct: opt })}
                        className={`flex-1 py-4 rounded-2xl font-bold transition-all ${editingCard.correct === opt ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-zinc-50 text-zinc-400'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">Fundamento</label>
                  <textarea 
                    value={editingCard.fundamento || ''}
                    onChange={e => setEditingCard({ ...editingCard, fundamento: e.target.value })}
                    className="w-full p-4 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none min-h-[100px]"
                  />
                </div>
              </div>
              <div className="p-8 bg-zinc-50 border-t border-zinc-100">
                <button 
                  onClick={saveEdit}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Salvar Alterações
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
