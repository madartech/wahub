import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappService } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { MessageSquare, Image, FileText, Loader2, Send } from 'lucide-react';

export default function SendMessage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Text form
  const [textNumber, setTextNumber] = useState('');
  const [textMessage, setTextMessage] = useState('');

  // Image form
  const [imageNumber, setImageNumber] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageCaption, setImageCaption] = useState('');

  // PDF form
  const [pdfNumber, setPdfNumber] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfCaption, setPdfCaption] = useState('');

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.apiKey) return;

    setIsLoading(true);
    try {
      await whatsappService.sendText(user.apiKey, {
        number: textNumber,
        message: textMessage,
      });
      toast.success('Text message sent successfully!');
      setTextNumber('');
      setTextMessage('');
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.apiKey || !imageFile) return;

    setIsLoading(true);
    try {
      await whatsappService.sendImage(user.apiKey, {
        number: imageNumber,
        file: imageFile,
        caption: imageCaption,
      });
      toast.success('Image sent successfully!');
      setImageNumber('');
      setImageFile(null);
      setImageCaption('');
    } catch (error) {
      toast.error('Failed to send image');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPDF = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.apiKey || !pdfFile) return;

    setIsLoading(true);
    try {
      await whatsappService.sendPDF(user.apiKey, {
        number: pdfNumber,
        file: pdfFile,
        caption: pdfCaption,
      });
      toast.success('PDF sent successfully!');
      setPdfNumber('');
      setPdfFile(null);
      setPdfCaption('');
    } catch (error) {
      toast.error('Failed to send PDF');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare className="w-6 h-6" />
            Send Message
          </h1>
          <p className="text-muted-foreground">Send texts, images, and documents via WhatsApp</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Tabs defaultValue="text" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="text" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Text</span>
                </TabsTrigger>
                <TabsTrigger value="image" className="flex items-center gap-2">
                  <Image className="w-4 h-4" />
                  <span className="hidden sm:inline">Image</span>
                </TabsTrigger>
                <TabsTrigger value="pdf" className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">PDF</span>
                </TabsTrigger>
              </TabsList>

              {/* Send Text */}
              <TabsContent value="text">
                <form onSubmit={handleSendText} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="text-number">Phone Number</Label>
                    <Input
                      id="text-number"
                      placeholder="e.g., 1234567890"
                      value={textNumber}
                      onChange={(e) => setTextNumber(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Include country code without + or spaces
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="text-message">Message</Label>
                    <Textarea
                      id="text-message"
                      placeholder="Type your message here..."
                      value={textMessage}
                      onChange={(e) => setTextMessage(e.target.value)}
                      rows={4}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send Text
                  </Button>
                </form>
              </TabsContent>

              {/* Send Image */}
              <TabsContent value="image">
                <form onSubmit={handleSendImage} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="image-number">Phone Number</Label>
                    <Input
                      id="image-number"
                      placeholder="e.g., 1234567890"
                      value={imageNumber}
                      onChange={(e) => setImageNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image-file">Image File</Label>
                    <Input
                      id="image-file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                      required
                      className="cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image-caption">Caption (optional)</Label>
                    <Input
                      id="image-caption"
                      placeholder="Add a caption..."
                      value={imageCaption}
                      onChange={(e) => setImageCaption(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send Image
                  </Button>
                </form>
              </TabsContent>

              {/* Send PDF */}
              <TabsContent value="pdf">
                <form onSubmit={handleSendPDF} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pdf-number">Phone Number</Label>
                    <Input
                      id="pdf-number"
                      placeholder="e.g., 1234567890"
                      value={pdfNumber}
                      onChange={(e) => setPdfNumber(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pdf-file">PDF File</Label>
                    <Input
                      id="pdf-file"
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      required
                      className="cursor-pointer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pdf-caption">Caption (optional)</Label>
                    <Input
                      id="pdf-caption"
                      placeholder="Add a caption..."
                      value={pdfCaption}
                      onChange={(e) => setPdfCaption(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    Send PDF
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
