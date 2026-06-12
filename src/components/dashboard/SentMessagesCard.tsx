import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, TrendingUp } from 'lucide-react';
import { gatewayService } from '@/services/gateway';
import { GatewayUser } from '@/types/gateway';

const WEEKLY_KEY = 'gateway_sent_daily_history_v1';

interface DailySnapshot {
  date: string; // YYYY-MM-DD
  total: number;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function readHistory(): DailySnapshot[] {
  try {
    const raw = localStorage.getItem(WEEKLY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as DailySnapshot[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeHistory(history: DailySnapshot[]) {
  // Keep last 14 days max
  const trimmed = history.slice(-14);
  localStorage.setItem(WEEKLY_KEY, JSON.stringify(trimmed));
}

function recordToday(total: number): DailySnapshot[] {
  const history = readHistory();
  const today = todayKey();
  const existingIdx = history.findIndex((h) => h.date === today);
  if (existingIdx >= 0) {
    // Take the max for the day (counter only grows then resets at midnight backend-side)
    history[existingIdx] = { date: today, total: Math.max(history[existingIdx].total, total) };
  } else {
    history.push({ date: today, total });
  }
  writeHistory(history);
  return history;
}

function sumLast7Days(history: DailySnapshot[]): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return history
    .filter((h) => new Date(h.date).getTime() >= cutoff)
    .reduce((a, h) => a + h.total, 0);
}

export default function SentMessagesCard() {
  const [today, setToday] = useState<number | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await gatewayService.getUsers();
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error || 'Failed to load');
        return;
      }
      const dayTotal = res.users.reduce(
        (a: number, u: GatewayUser) => a + (u.sendStats?.day ?? 0),
        0,
      );
      const history = recordToday(dayTotal);
      setToday(dayTotal);
      setWeek(sumLast7Days(history));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="space-y-1">
          <CardTitle className="text-lg font-medium">Sent Messages</CardTitle>
          <CardDescription>Across all users</CardDescription>
        </div>
        <MessageSquare className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : today === null ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Skeleton className="h-9 w-16" /><Skeleton className="h-4 w-20" /></div>
            <div className="space-y-2"><Skeleton className="h-9 w-16" /><Skeleton className="h-4 w-20" /></div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-3xl font-bold tabular-nums">{today.toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Today</p>
            </div>
            <div>
              <div className="text-3xl font-bold tabular-nums flex items-center gap-1.5">
                {week?.toLocaleString() ?? '—'}
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Last 7 days</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
