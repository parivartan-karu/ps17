'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPolicyPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>Last updated: {new Date().toLocaleDateString()}</p>

          <p>
            Pune Municipal Corporation ("us", "we", or "our") operates the Parivartan website (the "Service").
            This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use
            our Service and the choices you have associated with that data.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">Information Collection and Use</h2>
          <p>
            We collect several different types of information for various purposes to provide and improve our Service to you.
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Personal Data:</strong> While using our Service, we may ask you to provide us with certain personally identifiable
              information that can be used to contact or identify you ("Personal Data"). This includes your name, email address,
              and Firebase authentication details.
            </li>
            <li>
              <strong>Report Data:</strong> When you submit a report, we collect the information you provide, including the problem category,
              description, photo evidence, and location data (GPS coordinates and address).
            </li>
            <li>
              <strong>Usage Data:</strong> We may also collect information on how the Service is accessed and used ("Usage Data"). This
              Usage Data may include information such as your computer's Internet Protocol address (e.g., IP address), browser type,
              browser version, the pages of our Service that you visit, the time and date of your visit, and other diagnostic data.
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground pt-4">Use of Data</h2>
          <p>SMC uses the collected data for various purposes:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>To provide and maintain our Service</li>
            <li>To manage and resolve the civic issues you report</li>
            <li>To provide citizen support</li>
            <li>To monitor the usage of our Service</li>
            <li>To detect, prevent and address technical issues</li>
            <li>To maintain a record of work done for accountability</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground pt-4">Security of Data</h2>
          <p>
            The security of your data is important to us, but remember that no method of transmission over the Internet or method
            of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal
            Data, we cannot guarantee its absolute security.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">Changes to This Privacy Policy</h2>
          <p>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy
            on this page. You are advised to review this Privacy Policy periodically for any changes.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
