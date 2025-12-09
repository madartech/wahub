import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappService } from '@/services/api';
import { MessageHistory as MessageHistoryType } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileText, Image, MessageSquare, Clock } from 'lucide-react';
import { format } from 'date-fns';

const statusVariantMap: Record<string, 'default' | 'success' | 'warning' | 'destructive'> = {
  pending: 'warning',
  sent: 'default',
  delivered: 'success',
  failed: 'destructive',
};

const typeIconMap: Record<string, React.ReactNode> = {
  text: <MessageSquare className="w-4 h-4" />,
  image: <Image className="w-4 h-4" />,
  pdf: <FileText className="w-4 h-4" />,
};

export default function MessageHistory() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageHistoryType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      if (user?.apiKey) {
        setLoading(true);
        const history = await whatsappService.getMessageHistory(user.apiKey);
        setMessages(history);
        setLoading(false);
      }
    };

    fetchHistory();
  }, [user?.apiKey]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Message History</h1>
          <p className="text-muted-foreground">View all sent messages with delivery status</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Recent Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No messages sent yet
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Content</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {messages.map((message) => (
                    <TableRow key={message.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {typeIconMap[message.messageType]}
                          <span className="capitalize text-sm">{message.messageType}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {message.recipientNumber}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {message.content}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(message.timestamp), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariantMap[message.status]}>
                          {message.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
