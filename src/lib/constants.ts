
export const departments = [
  'Engineering',
  'Sanitation',
  'Electrical',
  'Water Supply',
  'Parks & Environment',
  'Traffic & Roads',
  'Public Works',
];

// Department configuration with descriptions, icons, and roles
export const departmentConfig: Record<
  string,
  {
    id: string;
    description: string;
    color: string;
    icon: string;
    roles: string[];
  }
> = {
  Engineering: {
    id: 'dept_engineering',
    description: 'Handles infrastructure & construction',
    color: 'bg-blue-500',
    icon: '🏗️',
    roles: [
      'Civil Engineer',
      'Site Engineer',
      'Road Repair Technician',
      'Structural Engineer',
      'Surveyor',
      'Junior Engineer',
      'Maintenance Technician',
    ],
  },
  Sanitation: {
    id: 'dept_sanitation',
    description: 'Handles cleanliness & waste management',
    color: 'bg-green-500',
    icon: '🚮',
    roles: [
      'Sanitation Worker',
      'Sweeper',
      'Garbage Collector',
      'Waste Segregation Staff',
      'Truck Driver (Garbage Vehicle)',
      'Supervisor',
    ],
  },
  Electrical: {
    id: 'dept_electrical',
    description: 'Handles lighting & electrical systems',
    color: 'bg-amber-500',
    icon: '💡',
    roles: [
      'Electrician',
      'Line Technician',
      'Street Light Technician',
      'Electrical Engineer',
      'Maintenance Staff',
    ],
  },
  'Water Supply': {
    id: 'dept_water',
    description: 'Handles water systems',
    color: 'bg-cyan-500',
    icon: '🚰',
    roles: [
      'Plumber',
      'Pipeline Technician',
      'Water Supply Engineer',
      'Pump Operator',
      'Maintenance Worker',
    ],
  },
  'Parks & Environment': {
    id: 'dept_parks',
    description: 'Handles greenery & public parks',
    color: 'bg-emerald-500',
    icon: '🌳',
    roles: [
      'Gardener',
      'Tree Maintenance Worker',
      'Environmental Engineer',
      'Park Supervisor',
    ],
  },
  'Traffic & Roads': {
    id: 'dept_traffic',
    description: 'Handles traffic & signals',
    color: 'bg-red-500',
    icon: '🚧',
    roles: [
      'Traffic Engineer',
      'Signal Technician',
      'Road Safety Officer',
      'Field Worker',
    ],
  },
  'Public Works': {
    id: 'dept_public_works',
    description: 'General infrastructure support',
    color: 'bg-purple-500',
    icon: '🏢',
    roles: ['Project Manager', 'Supervisor', 'Technician', 'Field Worker'],
  },
};

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

// Department colors for visual distinction
export const departmentColorMap: Record<string, string> = {
  Engineering: '#3b82f6', // Blue
  Sanitation: '#22c55e', // Green
  Electrical: '#f59e0b', // Amber
  'Water Supply': '#06b6d4', // Cyan
  'Parks & Environment': '#10b981', // Emerald
  'Traffic & Roads': '#ef4444', // Red
  'Public Works': '#a855f7', // Purple
};

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
