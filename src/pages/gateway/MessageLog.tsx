import { useCallback, useEffect, useState } from 'react';
import GatewayLayout from '@/components/layout/GatewayLayout';
import { gatewayService } from '@/services/gateway';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowDown, ArrowUp, ChevronsUpDown, Loader2, RefreshCw } from 'lucide-react';

const PAGE_SIZE = 15;

type SortKey = 'at' | 'from' | 'to' | 'userName';

interface LogRow {
  id: string;
  userId: string;
  userName: string;
  from: string;
  to: string;
  at: string;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'userName', label: 'User' },
  { key: 'from', label: 'From' },
  { key: 'to', label: 'To' },
  { key: 'at', label: 'Date' },
];

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

export default function MessageLog() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>('at');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notInstalled, setNotInstalled] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await gatewayService.getMessageLog({
      page,
      pageSize: PAGE_SIZE,
      sort,
      dir,
      q: query || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      if (res.status === 404 || res.error === 'not_found') {
        setNotInstalled(true);
        setRows([]);
        setTotal(0);
        setError(null);
        return;
      }
      setError(res.error || 'Failed to load the log');
      return;
    }
    const data = res.data as { rows?: LogRow[]; total?: number } | null;
    setNotInstalled(false);
    setError(null);
    setRows(data?.rows ?? []);
    setTotal(data?.total ?? 0);
  }, [page, sort, dir, query]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSort = (key: SortKey) => {
    if (key === sort) {
      setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setDir(key === 'at' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <GatewayLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Message Log</h1>
            <p className="text-sm text-muted-foreground">
              Who sent to whom, and when. Message text is never stored.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>

        {notInstalled && (
          <Alert>
            <AlertDescription>
              The message log add-on is not installed on the server yet, so there is nothing
              to show. Once it is installed, every send appears here automatically.
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-medium">Sent messages</CardTitle>
                <CardDescription>{total} record{total === 1 ? '' : 's'}</CardDescription>
              </div>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setPage(1);
                  setQuery(search.trim());
                }}
              >
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search phone or user"
                  className="h-9 w-52"
                />
                <Button type="submit" size="sm" variant="secondary">
                  Search
                </Button>
              </form>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {COLUMNS.map((c) => (
                      <TableHead key={c.key}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => toggleSort(c.key)}
                        >
                          {c.label}
                          {sort === c.key ? (
                            dir === 'asc' ? (
                              <ArrowUp className="h-3.5 w-3.5" />
                            ) : (
                              <ArrowDown className="h-3.5 w-3.5" />
                            )
                          ) : (
                            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                          )}
                        </button>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No records yet
                      </TableCell>
                    </TableRow>
                  )}
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.userName || r.userId || '—'}</TableCell>
                      <TableCell className="font-mono text-sm">{r.from || '—'}</TableCell>
                      <TableCell className="font-mono text-sm">{r.to || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(r.at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between pt-4">
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => {
                    setPage((p) => Math.max(1, p - 1));
                    window.scrollTo(0, 0);
                  }}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => {
                    setPage((p) => Math.min(totalPages, p + 1));
                    window.scrollTo(0, 0);
                  }}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </GatewayLayout>
  );
}
