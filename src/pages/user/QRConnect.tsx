import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappService } from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, Phone, CheckCircle, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type Step = 'phone' | 'otp' | 'success';

export default function WhatsAppLogin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendOTP = async () => {
    if (!phone.trim()) {
      toast({
        title: 'Phone number required',
        description: 'Please enter your phone number with country code',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.apiKey) {
      toast({
        title: 'Error',
        description: 'API key not found',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await whatsappService.requestLoginCode(user.apiKey, phone);
      setStep('otp');
      toast({
        title: 'Code sent',
        description: 'Check your WhatsApp for the verification code',
      });
    } catch (error) {
      toast({
        title: 'Failed to send code',
        description: error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Please enter the 6-digit verification code',
        variant: 'destructive',
      });
      return;
    }

    if (!user?.apiKey) {
      toast({
        title: 'Error',
        description: 'API key not found',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      await whatsappService.verifyLoginCode(user.apiKey, otp);
      setStep('success');
      toast({
        title: 'Success!',
        description: 'WhatsApp connected successfully',
      });
      // Navigate to home after short delay
      setTimeout(() => navigate('/user/home'), 1500);
    } catch (error) {
      toast({
        title: 'Invalid code',
        description: 'The code is incorrect, please try again',
        variant: 'destructive',
      });
      setOtp('');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'success') {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-success" />
              </div>
              <CardTitle className="text-2xl">Connected!</CardTitle>
              <CardDescription>
                Your WhatsApp is connected and ready to send messages.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Phone className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">
              {step === 'phone' ? 'WhatsApp Login' : 'Enter Verification Code'}
            </CardTitle>
            <CardDescription>
              {step === 'phone' 
                ? 'Enter your phone number to receive a verification code' 
                : 'Enter the 6-digit code sent to your WhatsApp'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {step === 'phone' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number (with country code)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1234567890"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Include country code, e.g. +1 for USA, +44 for UK
                  </p>
                </div>
                <Button 
                  className="w-full" 
                  onClick={handleSendOTP}
                  disabled={isLoading || !phone.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send OTP'
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <InputOTP 
                      maxLength={6} 
                      value={otp} 
                      onChange={setOtp}
                      disabled={isLoading}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    Didn't receive a code?{' '}
                    <button 
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        setStep('phone');
                        setOtp('');
                      }}
                      disabled={isLoading}
                    >
                      Try again
                    </button>
                  </p>
                </div>
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={handleVerifyOTP}
                    disabled={isLoading || otp.length !== 6}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      'Verify Code'
                    )}
                  </Button>
                  <Button 
                    variant="ghost" 
                    className="w-full"
                    onClick={() => {
                      setStep('phone');
                      setOtp('');
                    }}
                    disabled={isLoading}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
