'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Report, User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Users,
  HardHat,
  Wrench,
  Trash2,
  Droplet,
  Lightbulb,
  Building2,
  ArrowRight,
} from 'lucide-react';

interface DepartmentSpecification {
  slug: string;
  name: string;
  description: string;
  teams: string[];
  legacyDepts: string[];
  categories: string[];
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  statBg: string;
}

const departmentSpecifications: DepartmentSpecification[] = [
  {
    slug: 'road-maintenance',
    name: 'Road Maintenance',
    description: 'Potholes, cracks, damaged roads & dividers',
    teams: ['Road Repair Teams', 'Asphalt Workers'],
    legacyDepts: ['Engineering', 'Traffic & Roads', 'Roads', 'Road Maintenance Department'],
    categories: ['Pothole', 'Crack', 'Surface failure', 'Road marking', 'Traffic signal'],
    icon: Wrench,
    accent: 'text-blue-600 bg-blue-50 border-blue-100 dark:bg-blue-950/30 dark:border-blue-900',
    statBg: 'bg-blue-50 dark:bg-blue-950/20',
  },
  {
    slug: 'solid-waste',
    name: 'Solid Waste Management',
    description: 'Garbage, waste dumping, debris & overflowing bins',
    teams: ['Sanitation Teams', 'Garbage Truck Teams'],
    legacyDepts: ['Sanitation', 'Solid Waste Management Department'],
    categories: ['Garbage/Debris', 'Garbage'],
    icon: Trash2,
    accent: 'text-green-600 bg-green-50 border-green-100 dark:bg-green-950/30 dark:border-green-900',
    statBg: 'bg-green-50 dark:bg-green-950/20',
  },
  {
    slug: 'water-drainage',
    name: 'Water & Drainage',
    description: 'Drainage blockage, leakage, sewage & flooding',
    teams: ['Drainage Cleaners', 'Pipeline Teams'],
    legacyDepts: ['Water Supply', 'Drainage', 'Water & Drainage Department'],
    categories: ['Water leak', 'Pipe burst', 'Manhole issue', 'Water-logged damage'],
    icon: Droplet,
    accent: 'text-cyan-600 bg-cyan-50 border-cyan-100 dark:bg-cyan-950/30 dark:border-cyan-900',
    statBg: 'bg-cyan-50 dark:bg-cyan-950/20',
  },
  {
    slug: 'electrical',
    name: 'Electrical',
    description: 'Streetlight failures, exposed wires & electrical hazards',
    teams: ['Electrical Maintenance Teams'],
    legacyDepts: ['Electrical', 'Electricity', 'Electrical Department'],
    categories: ['Street light', 'Streetlight Issue'],
    icon: Lightbulb,
    accent: 'text-amber-600 bg-amber-50 border-amber-100 dark:bg-amber-950/30 dark:border-amber-900',
    statBg: 'bg-amber-50 dark:bg-amber-950/20',
  },
  {
    slug: 'public-works',
    name: 'Construction & Public Works',
    description: 'Construction debris, broken footpaths & public infrastructure',
    teams: ['Civil Work Teams'],
    legacyDepts: ['Public Works', 'Construction & Public Works Department'],
    categories: ['Public Works'],
    icon: Building2,
    accent: 'text-purple-600 bg-purple-50 border-purple-100 dark:bg-purple-950/30 dark:border-purple-900',
    statBg: 'bg-purple-50 dark:bg-purple-950/20',
  },
];

export default function SmcWardsPage() {
  const firestore = useFirestore();

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reports'));
  }, [firestore]);

  const workersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'worker'));
  }, [firestore]);

  const { data: reports, isLoading: isReportsLoading } = useCollection<Report>(reportsQuery);
  const { data: workers, isLoading: isWorkersLoading } = useCollection<User>(workersQuery);

  const departmentData = useMemo(() => {
    if (!reports) return null;
    const workerList = workers || [];

    return departmentSpecifications.map(spec => {
      let open = 0;

      reports.forEach(report => {
        const reportCategory = report.category || '';
        const reportDept = report.department || '';

        const matchesCategory = spec.categories.some(cat =>
          reportCategory.toLowerCase().includes(cat.toLowerCase())
        );
        const matchesDept =
          spec.legacyDepts.some(d => reportDept.toLowerCase() === d.toLowerCase()) ||
          reportDept.toLowerCase() === spec.name.toLowerCase();

        if ((matchesCategory || matchesDept) && report.status !== 'Resolved' && report.status !== 'Rejected') {
          open++;
        }
      });

      const totalWorkers = workerList.filter(worker => {
        const workerDept = worker.department || '';
        return (
          spec.legacyDepts.some(d => workerDept.toLowerCase() === d.toLowerCase()) ||
          workerDept.toLowerCase() === spec.name.toLowerCase()
        );
      }).length;

      return { ...spec, open, totalWorkers };
    });
  }, [reports, workers]);

  const isLoading = isReportsLoading || isWorkersLoading;

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 md:p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Departments</h1>
        <p className="text-base md:text-lg opacity-90">
          Real-time workers, open cases, and teams across all municipal departments.
        </p>
      </div>

      {isLoading && (
        <div className="grid gap-5 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3.5 w-full" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <Skeleton className="h-16 rounded-lg" />
                  <Skeleton className="h-16 rounded-lg" />
                  <Skeleton className="h-16 rounded-lg" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-9 rounded-md" />
                  <Skeleton className="h-9 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && departmentData && (
        <div className="grid gap-5 md:grid-cols-2">
          {departmentData.map(dept => {
            const IconComponent = dept.icon;
            return (
              <Card key={dept.slug} className="overflow-hidden border shadow-sm hover:shadow-md transition-shadow duration-200">
                <CardHeader className="pb-4">
                  <div className="flex items-start gap-4">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${dept.accent}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">
                        {dept.name} Department
                      </CardTitle>
                      <p className="mt-0.5 text-xs text-muted-foreground leading-snug">
                        {dept.description}
                      </p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className={`rounded-lg p-3 text-center ${dept.statBg}`}>
                      <p className="text-xl font-bold text-slate-800 dark:text-slate-200">{dept.totalWorkers}</p>
                      <p className="mt-1 text-[10px] font-medium text-muted-foreground flex items-center justify-center gap-1">
                        <Users className="h-3 w-3" /> Workers
                      </p>
                    </div>
                    <div className="rounded-lg p-3 text-center bg-amber-50 dark:bg-amber-950/20">
                      <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{dept.open}</p>
                      <p className="mt-1 text-[10px] font-medium text-muted-foreground flex items-center justify-center gap-1">
                        <Activity className="h-3 w-3" /> Open Cases
                      </p>
                    </div>
                    <div className="rounded-lg p-3 text-center bg-indigo-50 dark:bg-indigo-950/20">
                      <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400">{dept.teams.length}</p>
                      <p className="mt-1 text-[10px] font-medium text-muted-foreground flex items-center justify-center gap-1">
                        <HardHat className="h-3 w-3" /> Teams
                      </p>
                    </div>
                  </div>

                  {/* Navigation Buttons */}
                  <div className="grid grid-cols-2 gap-3">
                    <Button asChild variant="outline" size="sm" className="h-9 text-xs font-medium gap-1.5">
                      <Link href={`/smc/wards/${dept.slug}/workers`}>
                        <Users className="h-3.5 w-3.5" />
                        View Workers
                        <ArrowRight className="h-3 w-3 ml-auto" />
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="h-9 text-xs font-medium gap-1.5">
                      <Link href={`/smc/wards/${dept.slug}/teams`}>
                        <HardHat className="h-3.5 w-3.5" />
                        View Teams
                        <ArrowRight className="h-3 w-3 ml-auto" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
