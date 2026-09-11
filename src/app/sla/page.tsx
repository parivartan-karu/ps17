'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';


const slaData = [
  { category: 'Critical Potholes (Main Roads)', responseTime: '4 Hours', resolutionTime: '24 Hours' },
  { category: 'Road Damage (Major)', responseTime: '8 Hours', resolutionTime: '72 Hours' },
  { category: 'Street Light Outage', responseTime: '12 Hours', resolutionTime: '48 Hours' },
  { category: 'Drainage & Gutter Issues', responseTime: '12 Hours', resolutionTime: '96 Hours' },
  { category: 'Faded Road Markings', responseTime: '24 Hours', resolutionTime: '7 Days' },
  { category: 'Other Minor Issues', responseTime: '48 Hours', resolutionTime: '14 Days' },
];

export default function SLAPolicyPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto p-4 md:p-8">
      <Button variant="outline" onClick={() => router.back()} className="mb-4">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Service Level Agreement (SLA) Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            The Pune Municipal Corporation (PMC) is committed to providing timely and effective resolution for all civic
            issues reported through the Parivartan platform. This Service Level Agreement (SLA) outlines our commitment
            to response and resolution times.
          </p>

          <h2 className="text-xl font-semibold text-foreground pt-4">Definitions</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Response Time:</strong> The time taken from when a complaint is verified by an SMC officer to when it is
              assigned to a field worker or contractor for action.
            </li>
            <li>
              <strong>Resolution Time:</strong> The total time taken from when a complaint is verified to when the work is
              completed and marked as "Resolved" in the system.
            </li>
            <li>
              <strong>Business Hours:</strong> SLAs are typically measured against standard municipal working hours (10:00 AM to 6:00 PM, Monday to Saturday), excluding public holidays. Critical issues may be addressed outside these hours.
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground pt-4">SLA Targets</h2>
          <p>The following table outlines the target SLA for different categories of complaints. These timelines may be affected by factors such as weather conditions, resource availability, and the complexity of the issue.</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Complaint Category</TableHead>
                <TableHead>Target Response Time</TableHead>
                <TableHead>Target Resolution Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slaData.map((item) => (
                <TableRow key={item.category}>
                  <TableCell className="font-medium">{item.category}</TableCell>
                  <TableCell>{item.responseTime}</TableCell>
                  <TableCell>{item.resolutionTime}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <h2 className="text-xl font-semibold text-foreground pt-4">Escalation</h2>
          <p>
            If a complaint is not addressed within the specified SLA, it will be automatically escalated to a higher authority
            within the SMC for immediate attention. Citizens will be notified of any delays or changes in the expected
            resolution timeline.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
