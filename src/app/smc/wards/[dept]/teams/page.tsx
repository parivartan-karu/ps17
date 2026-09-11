'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, Crown, HardHat, Users } from 'lucide-react';

const DEPT_MAP: Record<string, { name: string; legacyDepts: string[]; teams: { name: string; leaderDesignation: string }[] }> = {
  'road-maintenance': {
    name: 'Road Maintenance Department',
    legacyDepts: ['Engineering', 'Traffic & Roads', 'Roads', 'Road Maintenance Department'],
    teams: [
      { name: 'Road Repair Teams', leaderDesignation: 'Road Repair Worker' },
      { name: 'Asphalt Workers', leaderDesignation: 'Asphalt Worker' },
    ],
  },
  'solid-waste': {
    name: 'Solid Waste Management Department',
    legacyDepts: ['Sanitation', 'Solid Waste Management Department'],
    teams: [
      { name: 'Sanitation Teams', leaderDesignation: 'Sanitation Crew' },
      { name: 'Garbage Truck Teams', leaderDesignation: 'Garbage Truck Driver' },
    ],
  },
  'water-drainage': {
    name: 'Water & Drainage Department',
    legacyDepts: ['Water Supply', 'Drainage', 'Water & Drainage Department'],
    teams: [
      { name: 'Drainage Cleaners', leaderDesignation: 'Drainage Cleaner' },
      { name: 'Pipeline Teams', leaderDesignation: 'Pipeline Technician' },
    ],
  },
  electrical: {
    name: 'Electrical Department',
    legacyDepts: ['Electrical', 'Electricity', 'Electrical Department'],
    teams: [
      { name: 'Electrical Maintenance Teams', leaderDesignation: 'Electrical Technician' },
    ],
  },
  'public-works': {
    name: 'Construction & Public Works Department',
    legacyDepts: ['Public Works', 'Construction & Public Works Department'],
    teams: [
      { name: 'Civil Work Teams', leaderDesignation: 'Civil Work Builder' },
    ],
  },
};

export default function DepartmentTeamsPage() {
  const { dept } = useParams<{ dept: string }>();
  const firestore = useFirestore();

  const spec = DEPT_MAP[dept];

  const workersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'worker'));
  }, [firestore]);

  const { data: allWorkers, isLoading } = useCollection<User>(workersQuery);

  // Group workers by their designation → team
  const teamsData = useMemo(() => {
    if (!allWorkers || !spec) return [];

    const deptWorkers = allWorkers.filter(worker => {
      const workerDept = worker.department || '';
      return spec.legacyDepts.some(d => workerDept.toLowerCase() === d.toLowerCase());
    });

    return spec.teams.map(team => {
      // Workers whose designation matches this team's leaderDesignation are likely team members
      // Workers with skillType matching the team name also count
      const members = deptWorkers.filter(w => {
        const des = (w.designation || '').toLowerCase();
        const skill = (w.skillType || '').toLowerCase();
        const teamLower = team.name.toLowerCase();
        const leaderDesLower = team.leaderDesignation.toLowerCase();
        return des.includes(leaderDesLower) || skill.includes(teamLower.split(' ')[0]);
      });

      // Heuristic: first member with highest seniority or employee ID is leader
      // Otherwise treat first member as team lead
      const leader = members.find(w => w.workerRole?.skillLevel === 'Lead') ?? members[0] ?? null;
      const regularMembers = members.filter(w => w.id !== leader?.id);

      return {
        ...team,
        leader,
        members: regularMembers,
        total: members.length,
      };
    });
  }, [allWorkers, spec]);

  if (!spec) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/smc/wards"><ArrowLeft className="mr-2 h-4 w-4" />Back to Departments</Link>
        </Button>
        <Card><CardContent className="py-12 text-center text-muted-foreground">Department not found.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button asChild variant="ghost" className="px-0">
        <Link href="/smc/wards"><ArrowLeft className="mr-2 h-4 w-4" />Back to Departments</Link>
      </Button>

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 md:p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">{spec.name}</h1>
        <p className="text-sm md:text-base opacity-90">Specialist teams, their leaders, and members.</p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-6 w-1/3" /></CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 3 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Teams */}
      {!isLoading && (
        <div className="space-y-5">
          {teamsData.map(team => (
            <Card key={team.name} className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2.5 text-base font-bold">
                    <HardHat className="h-5 w-5 text-primary" />
                    {team.name}
                  </CardTitle>
                  <Badge variant="secondary" className="text-xs">
                    <Users className="h-3 w-3 mr-1" />
                    {team.total} member{team.total !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <CardDescription>{spec.name}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {team.total === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No members assigned to this team yet.</p>
                  </div>
                ) : (
                  <>
                    {/* Team Leader */}
                    {team.leader && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Team Leader</p>
                        <div className="flex items-center gap-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 px-4 py-3">
                          <Avatar className="h-10 w-10 shrink-0">
                            <AvatarFallback className="text-sm font-bold bg-amber-100 text-amber-700">
                              {team.leader.name?.charAt(0).toUpperCase() ?? '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{team.leader.name}</p>
                              <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            </div>
                            <p className="text-xs text-muted-foreground">{team.leader.designation || team.leaderDesignation}</p>
                          </div>
                          {team.leader.employeeId && (
                            <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                              {team.leader.employeeId}
                            </Badge>
                          )}
                          <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500 shrink-0">Lead</Badge>
                        </div>
                      </div>
                    )}

                    {/* Team Members */}
                    {team.members.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Members</p>
                        <div className="space-y-2">
                          {team.members.map(member => (
                            <div
                              key={member.id}
                              className="flex items-center gap-3 rounded-lg border bg-muted/20 px-4 py-2.5"
                            >
                              <Avatar className="h-8 w-8 shrink-0">
                                <AvatarFallback className="text-xs font-bold">
                                  {member.name?.charAt(0).toUpperCase() ?? '?'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{member.name}</p>
                                <p className="text-xs text-muted-foreground truncate">{member.designation || member.skillType || 'Field Worker'}</p>
                              </div>
                              {member.employeeId && (
                                <span className="text-[10px] font-mono text-muted-foreground shrink-0">{member.employeeId}</span>
                              )}
                              <Badge variant={member.isAvailable !== false ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                                {member.isAvailable !== false ? 'Available' : 'Busy'}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
