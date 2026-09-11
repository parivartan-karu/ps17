
import { CANONICAL_DEPARTMENTS } from './departments';

export const departments = CANONICAL_DEPARTMENTS.map((dept) => dept.name);

// Department configuration with descriptions, icons, and roles derived from canonical source
export const departmentConfig: Record<
  string,
  {
    id: string;
    description: string;
    color: string;
    icon: string;
    roles: string[];
  }
> = CANONICAL_DEPARTMENTS.reduce((acc, dept) => {
  acc[dept.name] = {
    id: dept.id,
    description: dept.description,
    color: dept.bgColor,
    icon: dept.icon,
    roles: dept.roles,
  };
  return acc;
}, {} as Record<string, { id: string; description: string; color: string; icon: string; roles: string[] }>);

// Status colors for admin map understanding
export const statusColorMap: Record<string, { bg: string; border: string; text: string }> = {
  Submitted: {
    bg: 'bg-blue-500',
    border: 'border-blue-500',
    text: 'text-blue-500',
  },
  'Under Verification': {
    bg: 'bg-yellow-500',
    border: 'border-yellow-500',
    text: 'text-yellow-500',
  },
  Assigned: {
    bg: 'bg-orange-500',
    border: 'border-orange-500',
    text: 'text-orange-500',
  },
  'In Progress': {
    bg: 'bg-amber-500',
    border: 'border-amber-500',
    text: 'text-amber-500',
  },
  Resolved: {
    bg: 'bg-green-500',
    border: 'border-green-500',
    text: 'text-green-500',
  },
  Rejected: {
    bg: 'bg-red-500',
    border: 'border-red-500',
    text: 'text-red-500',
  },
};

// Department colors for visual distinction derived from canonical source
export const departmentColorMap: Record<string, string> = CANONICAL_DEPARTMENTS.reduce((acc, dept) => {
  acc[dept.name] = dept.color;
  return acc;
}, {} as Record<string, string>);

// Map legend configuration for admin dashboard
export const mapLegendConfig = {
  status: [
    { label: 'Pending', color: '#ef4444', icon: '🔴' },
    { label: 'In Progress', color: '#f59e0b', icon: '🟠' },
    { label: 'Resolved', color: '#22c55e', icon: '🟢' },
  ],
  clustering: {
    label: 'Cluster',
    color: '#8b5cf6',
    icon: '🟣',
    description: 'Multiple reports at same location',
  },
};

// Status workflow configuration
export const statusWorkflow: Record<string, { next: string[]; canAssignWorker: boolean }> = {
  'Submitted': { next: ['Under Verification', 'Rejected'], canAssignWorker: false },
  'Under Verification': { next: ['Assigned', 'Rejected'], canAssignWorker: false },
  'Assigned': { next: ['In Progress', 'Rejected'], canAssignWorker: true },
  'In Progress': { next: ['Resolved', 'Rejected'], canAssignWorker: false },
  'Resolved': { next: [], canAssignWorker: false },
  'Rejected': { next: [], canAssignWorker: false },
};

// Worker Assignment Types - AI + Rule-Based System
export const assignmentTypes = {
  AUTO_ASSIGN: 'auto_assign',
  ADMIN_ASSIGN: 'admin_assign',
  ADMIN_OVERRIDE: 'admin_override',
  BULK_ASSIGN: 'bulk_assign',
  QUEUE_ASSIGN: 'queue_assign',
};

// Assignment Strategy Configuration
export const assignmentStrategy = {
  PRIMARY_FACTORS: [
    'availability',
    'location_distance',
    'workload_balance',
  ],
  SELECTION_FORMULA: 'Nearest + Least Busy + Available (in priority order)',
  ADMIN_ROLE: 'Monitor, Override, and Supervise',
  ENABLE_SMART_QUEUE: true,
  ENABLE_BULK_OPERATIONS: true,
  ENABLE_OVERLOAD_ALERTS: true,
};
