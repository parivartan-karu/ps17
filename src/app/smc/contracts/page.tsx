  'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth, useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { addDoc, collection, orderBy, query, serverTimestamp } from 'firebase/firestore';
import type { Report } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { UserCheck, ClipboardPlus, Upload, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, Trash2, Clock, Users, Copy, Check, MessageSquareWarning, Building, TrendingUp, ShieldAlert, Award, AlertTriangle, Activity } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { DeptIcon } from '@/components/dept-icon';
import { useToast } from '@/hooks/use-toast';
import { buildAuthHeaders } from '@/lib/client-auth';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';



const DEPARTMENT_OPTIONS = [
  'Road Maintenance Department',
  'Solid Waste Management Department',
  'Water & Drainage Department',
  'Electrical Department',
  'Construction & Public Works Department',
  'Parks & Environment',
  'Traffic & Roads',
  'Public Works',
];

const DEPARTMENT_METADATA: Record<
  string,
  { roles: string[]; skills: string[] }
> = {
  'Road Maintenance Department': {
    roles: [
      'Road Repair Worker',
      'Asphalt Worker',
      'Road Repair Technician',
      'Civil Work Builder',
      'Junior Engineer',
      'Maintenance Technician',
    ],
    skills: [
      'Road Repair',
      'Asphalt Work',
      'Civil Works',
      'General Maintenance',
    ],
  },
  'Engineering': {
    roles: [
      'Road Repair Worker',
      'Asphalt Worker',
      'Road Repair Technician',
      'Civil Engineer',
      'Structural Engineer',
      'Junior Engineer',
      'Maintenance Technician',
    ],
    skills: [
      'Road Repair',
      'Asphalt Work',
      'Civil Works',
      'General Maintenance',
    ],
  },
  'Solid Waste Management Department': {
    roles: [
      'Sanitation Crew',
      'Garbage Truck Driver',
      'Sanitation Worker',
      'Sweeper',
      'Garbage Collector',
      'Waste Segregation Staff',
      'Supervisor',
    ],
    skills: [
      'Sanitation',
      'Garbage Truck Operation',
      'Garbage',
      'General Maintenance',
    ],
  },
  'Sanitation': {
    roles: [
      'Sanitation Crew',
      'Garbage Truck Driver',
      'Sanitation Worker',
      'Sweeper',
      'Garbage Collector',
      'Waste Segregation Staff',
      'Supervisor',
    ],
    skills: [
      'Sanitation',
      'Garbage Truck Operation',
      'Garbage',
      'General Maintenance',
    ],
  },
  'Water & Drainage Department': {
    roles: [
      'Drainage Cleaner',
      'Pipeline Technician',
      'Plumber',
      'Water Supply Engineer',
      'Pump Operator',
      'Maintenance Worker',
    ],
    skills: [
      'Drainage Cleaning',
      'Pipeline Work',
      'General Maintenance',
    ],
  },
  'Water Supply': {
    roles: [
      'Drainage Cleaner',
      'Pipeline Technician',
      'Plumber',
      'Water Supply Engineer',
      'Pump Operator',
      'Maintenance Worker',
    ],
    skills: [
      'Drainage Cleaning',
      'Pipeline Work',
      'General Maintenance',
    ],
  },
  'Electrical Department': {
    roles: [
      'Electrical Technician',
      'Electrician',
      'Street Light Technician',
      'Line Technician',
      'Electrical Engineer',
      'Maintenance Staff',
    ],
    skills: [
      'Electrical Maintenance',
      'Electrical',
      'General Maintenance',
    ],
  },
  'Electrical': {
    roles: [
      'Electrical Technician',
      'Electrician',
      'Street Light Technician',
      'Line Technician',
      'Electrical Engineer',
      'Maintenance Staff',
    ],
    skills: [
      'Electrical Maintenance',
      'Electrical',
      'General Maintenance',
    ],
  },
  'Construction & Public Works Department': {
    roles: [
      'Civil Work Builder',
      'Project Manager',
      'Supervisor',
      'Technician',
      'Field Worker',
    ],
    skills: [
      'Civil Works',
      'Road Repair',
      'General Maintenance',
    ],
  },
  'Public Works': {
    roles: [
      'Civil Work Builder',
      'Project Manager',
      'Supervisor',
      'Technician',
      'Field Worker',
    ],
    skills: [
      'Civil Works',
      'Road Repair',
      'General Maintenance',
    ],
  },
  'Parks & Environment': {
    roles: [
      'Gardener',
      'Tree Maintenance Worker',
      'Park Supervisor',
      'Environmental Engineer',
      'Maintenance Worker',
    ],
    skills: [
      'General Maintenance',
      'Civil Works',
    ],
  },
  'Traffic & Roads': {
    roles: [
      'Road Safety Officer',
      'Signal Technician',
      'Traffic Engineer',
      'Field Worker',
      'Road Repair Worker',
    ],
    skills: [
      'Road Repair',
      'Electrical Maintenance',
      'General Maintenance',
    ],
  },
};

const DEFAULT_SKILL_OPTIONS = [
  'Road Repair',
  'Asphalt Work',
  'Sanitation',
  'Garbage Truck Operation',
  'Drainage Cleaning',
  'Pipeline Work',
  'Electrical Maintenance',
  'Civil Works',
  'General Maintenance',
];

const DEFAULT_DESIGNATION_OPTIONS = [
  'Road Repair Worker',
  'Asphalt Worker',
  'Sanitation Crew',
  'Garbage Truck Driver',
  'Drainage Cleaner',
  'Pipeline Technician',
  'Electrical Technician',
  'Civil Work Builder',
];

interface ContractorRecord {
  id: string;
  name: string;
  phoneNumber?: string;
  email?: string;
  department?: string;
  wardArea?: string;
}

export default function SmcContractsPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCreatingContractor, setIsCreatingContractor] = useState(false);
  const [newContractor, setNewContractor] = useState({
    name: '', phoneNumber: '', email: '', department: 'Road Maintenance Department', wardArea: '',
  });
  const [isCreatingWorker, setIsCreatingWorker] = useState(false);
  const [workerCreateConflictMessage, setWorkerCreateConflictMessage] = useState<string | null>(null);
  const [newWorker, setNewWorker] = useState({
    fullName: '', phoneNumber: '', email: '', department: 'Road Maintenance Department',
    designation: 'Road Repair Worker', skillType: 'Road Repair', assignedContractor: '', wardArea: '',
  });
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<'contractor' | 'worker' | null>(null);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reports'));
  }, [firestore]);

  const contractorsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'contractors'));
  }, [firestore]);

  const { data: reports, isLoading } = useCollection<Report>(reportsQuery);
  const { data: contractors } = useCollection<ContractorRecord>(contractorsQuery);

  const contractorDepartmentMap = useMemo(() => {
    const map: Record<string, string> = {};
    (contractors || []).forEach((c) => { if (c.name && c.department) map[c.name] = c.department; });
    (reports || []).forEach((r) => { if (r.assignedContractor && r.department && !map[r.assignedContractor]) map[r.assignedContractor] = r.department; });
    return map;
  }, [reports, contractors]);

  const contractorOptions = useMemo(() => {
    const set = new Set<string>();
    (contractors || []).forEach(c => { if (c.name) set.add(c.name); });
    return Array.from(set).sort();
  }, [contractors]);

  const departmentPerformance = useMemo(() => {
    const deptMap: Record<string, {
      name: string;
      contractorCount: number;
      activeCases: number;
      resolvedCases: number;
      overdueCases: number;
      totalCases: number;
      slaCompliance: number;
      healthStatus: 'Optimal' | 'At Risk' | 'Critical SLA Breach';
    }> = {};

    DEPARTMENT_OPTIONS.forEach((dept) => {
      deptMap[dept] = {
        name: dept,
        contractorCount: 0,
        activeCases: 0,
        resolvedCases: 0,
        overdueCases: 0,
        totalCases: 0,
        slaCompliance: 100,
        healthStatus: 'Optimal',
      };
    });

    (contractors || []).forEach((c) => {
      if (c.department) {
        if (!deptMap[c.department]) {
          deptMap[c.department] = {
            name: c.department,
            contractorCount: 0,
            activeCases: 0,
            resolvedCases: 0,
            overdueCases: 0,
            totalCases: 0,
            slaCompliance: 100,
            healthStatus: 'Optimal',
          };
        }
        deptMap[c.department].contractorCount += 1;
      }
    });

    const nowMs = Date.now();
    (reports || []).forEach((r) => {
      const deptName = r.department || 'Unassigned';
      if (!deptMap[deptName]) {
        deptMap[deptName] = {
          name: deptName,
          contractorCount: 0,
          activeCases: 0,
          resolvedCases: 0,
          overdueCases: 0,
          totalCases: 0,
          slaCompliance: 100,
          healthStatus: 'Optimal',
        };
      }
      const entry = deptMap[deptName];
      entry.totalCases += 1;

      const isActive = ['Submitted', 'Under Verification', 'Assigned', 'In Progress'].includes(r.status);
      if (isActive) {
        entry.activeCases += 1;
        const isOverdue = r.slaBreached || (r.slaDeadline && new Date(r.slaDeadline).getTime() < nowMs);
        if (isOverdue) entry.overdueCases += 1;
      }
      if (r.status === 'Resolved') {
        entry.resolvedCases += 1;
      }
    });

    return Object.values(deptMap).map((d) => {
      const slaBreaches = (reports || []).filter(
        (r) => (r.department === d.name || (!r.department && d.name === 'Unassigned')) && r.slaBreached
      ).length;
      const slaCompliance = d.totalCases > 0 ? Math.max(0, Math.round(((d.totalCases - slaBreaches) / d.totalCases) * 100)) : 100;

      let healthStatus: 'Optimal' | 'At Risk' | 'Critical SLA Breach' = 'Optimal';
      if (d.overdueCases > 2 || slaCompliance < 70) healthStatus = 'Critical SLA Breach';
      else if (d.overdueCases > 0 || slaCompliance < 85) healthStatus = 'At Risk';

      return {
        ...d,
        slaCompliance,
        healthStatus,
      };
    }).sort((a, b) => (b.activeCases + b.contractorCount) - (a.activeCases + a.contractorCount));
  }, [reports, contractors]);

  const handleNewContractorChange = (field: keyof typeof newContractor, value: string) => {
    setNewContractor((previous) => ({ ...previous, [field]: value }));
  };

  const handleCreateContractor = async () => {
    if (!newContractor.name || !newContractor.phoneNumber || !newContractor.department) {
      toast({
        variant: 'destructive',
        title: 'Required fields missing',
        description: 'Contractor name, phone number, and department are required.',
      });
      return;
    }

    setIsCreatingContractor(true);
    try {
      const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
      const response = await fetch('/api/smc/contractors', {
        method: 'POST',
        headers,
        body: JSON.stringify(newContractor),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Contractor creation failed.');
      }

      toast({ title: 'Contractor added', description: `${newContractor.name} is now available for worker assignment.` });
      setNewContractor({
        name: '',
        phoneNumber: '',
        email: '',
        department: 'Road Maintenance Department',
        wardArea: '',
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Could not add contractor',
        description: error instanceof Error ? error.message : 'Unknown error occurred while adding contractor.',
      });
    } finally {
      setIsCreatingContractor(false);
    }
  };

  const handleNewWorkerChange = (field: keyof typeof newWorker, value: string) => {
    if (workerCreateConflictMessage && (field === 'phoneNumber' || field === 'email')) {
      setWorkerCreateConflictMessage(null);
    }
    setNewWorker((previous) => ({ ...previous, [field]: value }));
  };

  const availableRoles = useMemo(() => {
    return DEPARTMENT_METADATA[newWorker.department]?.roles || DEFAULT_DESIGNATION_OPTIONS;
  }, [newWorker.department]);

  const availableSkills = useMemo(() => {
    return DEPARTMENT_METADATA[newWorker.department]?.skills || DEFAULT_SKILL_OPTIONS;
  }, [newWorker.department]);

  const handleWorkerDepartmentChange = (department: string) => {
    const meta = DEPARTMENT_METADATA[department];
    const defaultRole = meta?.roles[0] || DEFAULT_DESIGNATION_OPTIONS[0];
    const defaultSkill = meta?.skills[0] || DEFAULT_SKILL_OPTIONS[0];

    const currentRoleValid = meta?.roles.includes(newWorker.designation);
    const currentSkillValid = meta?.skills.includes(newWorker.skillType);

    setNewWorker((previous) => ({
      ...previous,
      department,
      designation: currentRoleValid ? previous.designation : defaultRole,
      skillType: currentSkillValid ? previous.skillType : defaultSkill,
    }));
  };

  const handleConfirmAction = () => {
    setIsConfirmOpen(false);
    if (pendingAction === 'contractor') {
      handleCreateContractor();
    } else if (pendingAction === 'worker') {
      handleCreateWorker();
    }
    setPendingAction(null);
  };

  const requestCreateContractor = () => {
    if (!newContractor.name || !newContractor.phoneNumber || !newContractor.department) {
      toast({
        variant: 'destructive',
        title: 'Required fields missing',
        description: 'Contractor name, phone number, and department are required.',
      });
      return;
    }
    setPendingAction('contractor');
    setIsConfirmOpen(true);
  };

  const requestCreateWorker = () => {
    setWorkerCreateConflictMessage(null);
    if (
      !newWorker.fullName ||
      !newWorker.phoneNumber ||
      !newWorker.department ||
      !newWorker.designation ||
      !newWorker.skillType ||
      !newWorker.assignedContractor ||
      !newWorker.wardArea
    ) {
      toast({
        variant: 'destructive',
        title: 'Required fields missing',
        description: 'Fill all required worker details before adding.',
      });
      return;
    }
    setPendingAction('worker');
    setIsConfirmOpen(true);
  };

  const [createdWorkerModal, setCreatedWorkerModal] = useState<{
    workerId: string;
    password: string;
    fullName: string;
    phoneNumber: string;
    smsStatus: string;
    smsError?: string | null;
  } | null>(null);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  const handleCreateWorker = async () => {
    setIsCreatingWorker(true);
    try {
      const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
      const response = await fetch('/api/smc/workers', {
        method: 'POST',
        headers,
        body: JSON.stringify(newWorker),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Worker creation failed.');
      }

      setCreatedWorkerModal({
        workerId: data.workerId,
        password: data.password,
        fullName: newWorker.fullName,
        phoneNumber: newWorker.phoneNumber,
        smsStatus: data.smsStatus,
        smsError: data.smsError,
      });

      toast({
        title: '✅ Worker Account Created',
        description:
          data?.smsStatus === 'failed'
            ? `Worker ID: ${data.workerId} | Password: ${data.password} (Twilio Trial notice)`
            : `Worker ID: ${data.workerId} | Password: ${data.password} (SMS sent)`,
        duration: 10000,
      });

      setNewWorker({
        fullName: '',
        phoneNumber: '',
        email: '',
        department: 'Road Maintenance Department',
        designation: 'Road Repair Worker',
        skillType: 'Road Repair',
        assignedContractor: '',
        wardArea: '',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred while adding worker.';
      const isExpectedConflict = /already exists/i.test(message);
      if (isExpectedConflict) {
        setWorkerCreateConflictMessage(message);
        return;
      }

      if (!isExpectedConflict) {
        console.error(error);
      }
      toast({
        variant: 'destructive',
        title: 'Could not add worker',
        description: message,
      });
    } finally {
      setIsCreatingWorker(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 md:p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Department Performance</h1>
        <p className="text-base md:text-lg">Inspect department SLA performance metrics, contractor allocations, and city operations.</p>
      </div>

      {/* Department Performance Scorecard Card */}
      <Card className="border-indigo-100 bg-white shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-indigo-50/80 via-white to-purple-50/50 border-b p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
                <Building className="h-5 w-5 text-indigo-600" />
                Department Performance Scorecard
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 mt-1">
                Monitor municipal department efficiency, contractor allocation, active workloads, and SLA compliance.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-700 font-semibold text-xs px-3 py-1">
                <Users className="h-3.5 w-3.5 mr-1" />
                {contractors?.length || 0} Registered Contractors
              </Badge>
              <Button size="sm" variant="outline" asChild className="text-xs font-semibold text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                <Link href="/smc/analytics">Detailed Analytics &rarr;</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 hover:bg-slate-50/80 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <TableHead className="py-3 font-bold">Department</TableHead>
                  <TableHead className="text-center font-bold">Contractors</TableHead>
                  <TableHead className="text-center font-bold">Active Cases</TableHead>
                  <TableHead className="text-center font-bold">Resolved Cases</TableHead>
                  <TableHead className="text-center font-bold">SLA Compliance</TableHead>
                  <TableHead className="text-center font-bold">Overdue Queue</TableHead>
                  <TableHead className="text-right font-bold">Health Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departmentPerformance.length > 0 ? (
                  departmentPerformance.map((dept) => (
                    <TableRow key={dept.name} className="hover:bg-indigo-50/30 transition-colors">
                      <TableCell className="font-semibold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-indigo-100/70 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                            <DeptIcon dept={dept.name} className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{dept.name}</p>
                            <p className="text-[11px] text-muted-foreground">{dept.totalCases} total complaints filed</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        <Badge variant="secondary" className="bg-slate-100 font-bold text-xs">
                          {dept.contractorCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-slate-800">
                        {dept.activeCases > 0 ? (
                          <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-xs">
                            {dept.activeCases} Active
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold text-emerald-600">
                        {dept.resolvedCases}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center">
                          <span className={`text-xs font-extrabold ${dept.slaCompliance >= 85 ? 'text-emerald-600' : dept.slaCompliance >= 70 ? 'text-amber-600' : 'text-rose-600'}`}>
                            {dept.slaCompliance}%
                          </span>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full ${dept.slaCompliance >= 85 ? 'bg-emerald-500' : dept.slaCompliance >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${dept.slaCompliance}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {dept.overdueCases > 0 ? (
                          <Badge variant="destructive" className="font-bold text-[11px] px-2 py-0.5">
                            {dept.overdueCases} Overdue
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">0 Breaches</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={`text-[10px] font-bold px-2 py-0.5 ${
                          dept.healthStatus === 'Optimal'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : dept.healthStatus === 'At Risk'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}>
                          {dept.healthStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-muted-foreground text-xs">
                      Loading department performance metrics...
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserCheck /> Contractor & Worker Management</CardTitle>
          <CardDescription>Manually add contractors and field workers.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 rounded-xl border p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ClipboardPlus className="h-4 w-4" /> Add Contractor
            </h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Input
                value={newContractor.name}
                onChange={(event) => handleNewContractorChange('name', event.target.value)}
                placeholder="Contractor Name"
              />
              <Input
                value={newContractor.phoneNumber}
                onChange={(event) => handleNewContractorChange('phoneNumber', event.target.value)}
                placeholder="Phone Number"
              />
              <Input
                value={newContractor.email}
                onChange={(event) => handleNewContractorChange('email', event.target.value)}
                placeholder="Email (optional)"
              />
              <Select value={newContractor.department} onValueChange={(value) => handleNewContractorChange('department', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map((department) => (
                    <SelectItem key={department} value={department}>{department}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={newContractor.wardArea}
                onChange={(event) => handleNewContractorChange('wardArea', event.target.value)}
                placeholder="Ward / Area"
              />
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={requestCreateContractor} disabled={isCreatingContractor}>
                {isCreatingContractor ? 'Adding...' : 'Add Contractor'}
              </Button>
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-sm">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-indigo-950">Field Worker Registration Policy</h4>
                <p className="text-xs text-indigo-700 font-medium">
                  Field worker account registration is managed directly by respective Department Heads via their Department Operations Roster (<code className="bg-indigo-100 px-1 rounded text-indigo-900">/dept/workers</code>). Administrators manage Contractor registrations and municipal department contracts.
                </p>
              </div>
            </div>
            <Button size="sm" variant="outline" asChild className="shrink-0 text-xs font-bold border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50">
              <Link href="/dept/workers">View Department Workers &rarr;</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === 'contractor' && `This will add a new contractor: ${newContractor.name} to the ${newContractor.department}.`}
              {pendingAction === 'worker' && `This will add a new worker: ${newWorker.fullName} under contractor ${newWorker.assignedContractor}.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Worker Account Created Modal Dialog */}
      <Dialog open={!!createdWorkerModal} onOpenChange={(open) => { if (!open) setCreatedWorkerModal(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-2">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-xl font-bold">Worker Account Created</DialogTitle>
            <DialogDescription className="text-center text-xs">
              Account generated for <strong className="text-foreground">{createdWorkerModal?.fullName}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-2">
            <div className="rounded-xl bg-slate-50 border p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Employee Worker ID:</span>
                <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-slate-200">{createdWorkerModal?.workerId}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Auto-generated Password:</span>
                <span className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-slate-200">{createdWorkerModal?.password}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Mobile Number:</span>
                <span className="font-mono text-xs">{createdWorkerModal?.phoneNumber}</span>
              </div>
            </div>

            {/* SMS Status Banner */}
            {createdWorkerModal?.smsStatus === 'sent' ? (
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">SMS Dispatched</p>
                  <p className="text-[11px] text-emerald-700">Login credentials have been dispatched via SMS to {createdWorkerModal?.phoneNumber}.</p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
                <MessageSquareWarning className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">SMS Delivery Notice (Twilio Trial Account)</p>
                  <p className="text-[11px] text-amber-800 leading-relaxed mt-0.5">
                    Twilio Trial accounts restrict SMS delivery to numbers explicitly added & verified in the Twilio Console ({createdWorkerModal?.phoneNumber} is unverified).
                  </p>
                  <p className="text-[11px] font-semibold text-amber-950 mt-1">
                    💡 The account is active! Use the Worker ID & Password above to log in directly at <code className="bg-amber-100 px-1 rounded">/worker/login</code>.
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="sm:justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl gap-1.5 text-xs"
              onClick={() => {
                if (!createdWorkerModal) return;
                navigator.clipboard.writeText(`Worker ID: ${createdWorkerModal.workerId}\nPassword: ${createdWorkerModal.password}\nLogin Portal: /worker/login`);
                setCopiedCredentials(true);
                toast({ title: '📋 Credentials Copied', description: 'Worker ID and Password copied to clipboard.' });
                setTimeout(() => setCopiedCredentials(false), 2000);
              }}
            >
              {copiedCredentials ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copiedCredentials ? 'Copied!' : 'Copy Credentials'}
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"
              onClick={() => setCreatedWorkerModal(null)}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
