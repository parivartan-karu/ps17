'use client';

import { useMemo, useRef, useState } from 'react';
import { useAuth, useCollection, useMemoFirebase, useFirestore } from '@/firebase';
import { addDoc, collection, orderBy, query, serverTimestamp } from 'firebase/firestore';
import type { Report } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { UserCheck, ClipboardPlus, Upload, FileSpreadsheet, FileText, CheckCircle2, AlertCircle, Trash2, Clock, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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

      toast({
        title: 'Worker added successfully',
        description:
          data?.smsStatus === 'failed'
            ? `Worker ID ${data.workerId} created, but SMS failed. Share credentials manually.`
            : `Worker ID ${data.workerId} created and SMS sent with Worker ID and password.`,
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
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Contractors & Workers</h1>
        <p className="text-base md:text-lg">Manage contractors and add workers.</p>
      </div>

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

          <div className="mb-6 rounded-xl border p-4">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <ClipboardPlus className="h-4 w-4" /> Add Worker Under Contractor
            </h3>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Input
                value={newWorker.fullName}
                onChange={(event) => handleNewWorkerChange('fullName', event.target.value)}
                placeholder="Full Name"
              />
              <Input
                value={newWorker.phoneNumber}
                onChange={(event) => handleNewWorkerChange('phoneNumber', event.target.value)}
                placeholder="Phone Number"
              />
              <Input
                value={newWorker.email}
                onChange={(event) => handleNewWorkerChange('email', event.target.value)}
                placeholder="Email (optional)"
              />

              <Select value={newWorker.department} onValueChange={handleWorkerDepartmentChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_OPTIONS.map((department) => (
                    <SelectItem key={department} value={department}>{department}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={newWorker.designation} onValueChange={(value) => handleNewWorkerChange('designation', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Role / Designation" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((designation) => (
                    <SelectItem key={designation} value={designation}>{designation}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={newWorker.skillType} onValueChange={(value) => handleNewWorkerChange('skillType', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Skill Type" />
                </SelectTrigger>
                <SelectContent>
                  {availableSkills.map((skill) => (
                    <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={newWorker.assignedContractor}
                onValueChange={(value) => {
                  handleNewWorkerChange('assignedContractor', value);
                  const detectedDepartment = contractorDepartmentMap[value];
                  if (detectedDepartment && (DEPARTMENT_OPTIONS.includes(detectedDepartment) || DEPARTMENT_METADATA[detectedDepartment])) {
                    handleWorkerDepartmentChange(detectedDepartment);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Assigned Contractor" />
                </SelectTrigger>
                <SelectContent>
                  {contractorOptions.map((contractor) => (
                    <SelectItem key={contractor} value={contractor}>{contractor}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                value={newWorker.wardArea}
                onChange={(event) => handleNewWorkerChange('wardArea', event.target.value)}
                placeholder="Ward / Area"
              />

              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Worker ID and Password are auto-generated and sent by SMS after successful creation.
              </div>
            </div>

            {workerCreateConflictMessage ? (
              <Alert variant="destructive" className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Worker already exists</AlertTitle>
                <AlertDescription>{workerCreateConflictMessage}</AlertDescription>
              </Alert>
            ) : null}

            <div className="mt-4 flex justify-end">
              <Button onClick={requestCreateWorker} disabled={isCreatingWorker || contractorOptions.length === 0}>
                {isCreatingWorker ? 'Adding...' : 'Add Worker'}
              </Button>
            </div>
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
    </div>
  );
}
