'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function AboutSMCPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">About Pune Municipal Corporation (PMC)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            The Pune Municipal Corporation (PMC) is the governing body of the city of Pune in the Indian state of Maharashtra.
            It is responsible for the civic infrastructure and administration of the city. Established to provide essential
            services and to ensure the orderly development of the city, the SMC is committed to enhancing the quality of
            life for all its citizens.
          </p>
          <h2 className="text-xl font-semibold text-foreground pt-4">Our Mission</h2>
          <p>
            Our mission is to make Pune a clean, green, and economically vibrant city. We are dedicated to providing
            efficient, effective, and equitable services to our citizens. Through strategic planning, sustainable practices,
            and community participation, we aim to address the needs of our growing city and create a model of urban governance.
          </p>
          <h2 className="text-xl font-semibold text-foreground pt-4">Smart City Initiative</h2>
          <p>
            Parivartan is a flagship project under the Pune Smart City mission. It represents our commitment to leveraging
            technology for better governance and public service delivery. By empowering citizens to become the eyes and ears
            of the administration, we are fostering a collaborative environment to build and maintain world-class urban
            infrastructure. This platform is a step towards making our administration more transparent, responsive, and accountable.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
