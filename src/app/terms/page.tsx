'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsOfServicePage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Terms of Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>Last updated: {new Date().toLocaleDateString()}</p>

          <h2 className="text-xl font-semibold text-foreground pt-4">1. Acceptance of Terms</h2>
          <p>
            By accessing and using the Parivartan platform ("Service"), you accept and agree to be bound by the terms and
            provisions of this agreement. If you do not agree to abide by the above, please do not use this Service.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">2. User Conduct</h2>
          <p>
            You agree to use the Service only for lawful purposes. You are prohibited from posting on or transmitting through
            the Service any material that is harmful, threatening, abusive, or otherwise objectionable. You agree not to
            submit false, misleading, or frivolous reports. Misuse of the platform may result in suspension of your account
            and potential legal action.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">3. Content</h2>
          <p>
            When you submit a report, including text and images, you grant the Pune Municipal Corporation (PMC) a worldwide,
            non-exclusive, royalty-free license to use, reproduce, and display this content for the purpose of addressing the
            reported issue and for public accountability. You are solely responsible for the content you submit.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">4. Disclaimers</h2>
          <p>
            The Service is provided on an "as is" and "as available" basis. SMC makes no warranty that the Service will meet
            your requirements, be uninterrupted, timely, or error-free. While we strive to address all reports according
            to our SLA Policy, we do not guarantee resolution for every submitted issue.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">5. Limitation of Liability</h2>
          <p>
            In no event shall SMC be liable for any direct, indirect, incidental, or consequential damages resulting from the
            use or inability to use the Service.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">6. Changes to Terms</h2>
          <p>
            SMC reserves the right to modify these terms at any time. We will do so by posting the updated terms on the Service.
            Your decision to continue to visit and make use of the Service after such changes have been made constitutes
            your formal acceptance of the new Terms of Service.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
