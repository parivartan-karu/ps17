/**
 * Canonical Department Definitions & Normalization System for Parivartan
 * Single source of truth for municipal department domains, IDs, and legacy aliases.
 */

export type CanonicalDepartmentId =
  | 'dept_engineering'
  | 'dept_sanitation'
  | 'dept_electrical'
  | 'dept_water'
  | 'dept_parks'
  | 'dept_traffic'
  | 'dept_public_works';

export interface DepartmentDefinition {
  id: CanonicalDepartmentId;
  code: string;
  name: string; // Canonical display name
  description: string;
  color: string; // Hex color code
  bgColor: string; // Tailwind background color class
  icon: string; // Icon representation
  roles: string[];
  serviceCategories: string[];
  supportedIssueTypes: string[];
  legacyAliases: string[];
  headUserIds?: string[];
  escalationChain?: string[];
  defaultSlaProfile?: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const CANONICAL_DEPARTMENT_IDS: CanonicalDepartmentId[] = [
  'dept_engineering',
  'dept_sanitation',
  'dept_electrical',
  'dept_water',
  'dept_parks',
  'dept_traffic',
  'dept_public_works',
];

export const CANONICAL_DEPARTMENTS: DepartmentDefinition[] = [
  {
    id: 'dept_engineering',
    code: 'ENGINEERING',
    name: 'Engineering',
    description: 'Handles infrastructure & construction',
    color: '#3b82f6',
    bgColor: 'bg-blue-500',
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
    serviceCategories: ['infrastructure', 'construction', 'roads', 'potholes', 'footpaths', 'road_safety'],
    supportedIssueTypes: [
      'Pothole',
      'Road Cracks and Surface Damage',
      'Crack',
      'Surface failure',
      'Damaged Road',
      'Damaged Footpath',
      'Footpath Issue',
      'Road Safety Hazard',
      'Bridge repair',
      'Structural damage',
    ],
    legacyAliases: [
      'engineering',
      'civil engineering',
      'road repair',
      'pothole repair',
      'engineering dept',
      'engineering department',
      'roads department',
      'roads-dept',
      'roads',
      'road maintenance',
      'road repair department',
      'dept_engineering',
    ],
    active: true,
  },
  {
    id: 'dept_sanitation',
    code: 'SANITATION',
    name: 'Sanitation',
    description: 'Handles cleanliness & waste management',
    color: '#22c55e',
    bgColor: 'bg-green-500',
    icon: '🚮',
    roles: [
      'Sanitation Worker',
      'Sweeper',
      'Garbage Collector',
      'Waste Segregation Staff',
      'Truck Driver (Garbage Vehicle)',
      'Supervisor',
    ],
    serviceCategories: ['garbage', 'cleanliness', 'waste_management', 'dumping', 'waste_drainage'],
    supportedIssueTypes: [
      'Garbage/Debris',
      'Garbage Accumulation',
      'Illegal Dumping',
      'Overflowing Bins',
      'Overflowing Bin',
      'Uncollected Garbage',
      'Waste-related Drainage Blockage',
      'Uncleaned Street',
      'Dead Animal',
    ],
    legacyAliases: [
      'sanitation',
      'solid waste management department',
      'solid waste management',
      'waste management',
      'garbage',
      'garbage dept',
      'sanitation department',
      'cleanliness',
      'solid waste',
      'garbage department',
      'garbage-waste-dept',
      'garbage and waste management department',
      'garbage and waste management',
      'waste management department',
      'dept_sanitation',
    ],
    active: true,
  },
  {
    id: 'dept_electrical',
    code: 'ELECTRICAL',
    name: 'Electrical',
    description: 'Handles lighting & electrical systems',
    color: '#f59e0b',
    bgColor: 'bg-amber-500',
    icon: '💡',
    roles: [
      'Electrician',
      'Line Technician',
      'Street Light Technician',
      'Electrical Engineer',
      'Maintenance Staff',
    ],
    serviceCategories: ['lighting', 'power', 'streetlights'],
    supportedIssueTypes: ['Street light', 'Streetlight Issue', 'Power outage', 'Exposed wire', 'Transformer issue'],
    legacyAliases: [
      'electrical',
      'electrical department',
      'lighting',
      'street light',
      'street light department',
      'power',
      'electrical dept',
      'dept_electrical',
    ],
    active: true,
  },
  {
    id: 'dept_water',
    code: 'WATER_SUPPLY',
    name: 'Water Supply',
    description: 'Handles water systems',
    color: '#06b6d4',
    bgColor: 'bg-cyan-500',
    icon: '🚰',
    roles: [
      'Plumber',
      'Pipeline Technician',
      'Water Supply Engineer',
      'Pump Operator',
      'Maintenance Worker',
    ],
    serviceCategories: ['water', 'drainage', 'plumbing', 'sewage'],
    supportedIssueTypes: ['Water-logged damage', 'Manhole issue', 'Water leak', 'Pipe burst', 'Low water pressure', 'Contaminated water'],
    legacyAliases: [
      'water supply',
      'water & drainage department',
      'water department',
      'water',
      'drainage',
      'plumbing',
      'water and drainage',
      'water supply department',
      'dept_water',
    ],
    active: true,
  },
  {
    id: 'dept_parks',
    code: 'PARKS_ENVIRONMENT',
    name: 'Parks & Environment',
    description: 'Handles greenery & public parks',
    color: '#10b981',
    bgColor: 'bg-emerald-500',
    icon: '🌳',
    roles: [
      'Gardener',
      'Tree Maintenance Worker',
      'Environmental Engineer',
      'Park Supervisor',
    ],
    serviceCategories: ['parks', 'greenery', 'trees', 'environment'],
    supportedIssueTypes: ['Fallen Tree', 'Fallen Branch', 'Overgrown Vegetation', 'Park Maintenance', 'Garbage in Park'],
    legacyAliases: [
      'parks & environment',
      'parks and environment',
      'parks',
      'environment',
      'greenery',
      'horticulture',
      'parks department',
      'parks & environment department',
      'dept_parks',
    ],
    active: true,
  },
  {
    id: 'dept_traffic',
    code: 'TRAFFIC_ROADS',
    name: 'Traffic & Roads',
    description: 'Handles traffic & signals',
    color: '#ef4444',
    bgColor: 'bg-red-500',
    icon: '🚧',
    roles: [
      'Traffic Engineer',
      'Signal Technician',
      'Road Safety Officer',
      'Field Worker',
    ],
    serviceCategories: ['traffic', 'signals', 'road_safety', 'signage'],
    supportedIssueTypes: ['Traffic signal', 'Road marking', 'Damaged Signboard', 'Traffic Congestion Point', 'Illegal Barrier'],
    legacyAliases: [
      'traffic & roads',
      'traffic and roads',
      'road maintenance department',
      'traffic department',
      'traffic',
      'signals',
      'traffic & signal',
      'traffic & roads department',
      'dept_traffic',
    ],
    active: true,
  },
  {
    id: 'dept_public_works',
    code: 'PUBLIC_WORKS',
    name: 'Public Works',
    description: 'General infrastructure support',
    color: '#a855f7',
    bgColor: 'bg-purple-500',
    icon: '🏢',
    roles: ['Project Manager', 'Supervisor', 'Technician', 'Field Worker'],
    serviceCategories: ['public_works', 'general_infrastructure', 'civic_buildings'],
    supportedIssueTypes: ['Public Property Damage', 'Footpath Issue', 'Civic Building Maintenance', 'General Infrastructure'],
    legacyAliases: [
      'public works',
      'construction & public works department',
      'public works department',
      'pwd',
      'public works dept',
      'dept_public_works',
    ],
    active: true,
  },
];

export const CANONICAL_DEPARTMENT_MAP: Record<CanonicalDepartmentId, DepartmentDefinition> = CANONICAL_DEPARTMENTS.reduce(
  (acc, dept) => {
    acc[dept.id] = dept;
    return acc;
  },
  {} as Record<CanonicalDepartmentId, DepartmentDefinition>
);

/**
 * Normalizes an arbitrary string (ID, canonical name, or legacy alias) into a Canonical DepartmentDefinition.
 */
export function normalizeDepartment(input?: string | null): DepartmentDefinition | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  // 1. Direct ID match
  if (raw in CANONICAL_DEPARTMENT_MAP) {
    return CANONICAL_DEPARTMENT_MAP[raw as CanonicalDepartmentId];
  }

  const normalizedKey = raw.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 2. Match against canonical departments, legacy aliases, supportedIssueTypes, and serviceCategories
  for (const dept of CANONICAL_DEPARTMENTS) {
    const canonicalNameKey = dept.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const canonicalIdKey = dept.id.toLowerCase().replace(/[^a-z0-9]/g, '');
    const canonicalCodeKey = dept.code.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (
      normalizedKey === canonicalNameKey ||
      normalizedKey === canonicalIdKey ||
      normalizedKey === canonicalCodeKey
    ) {
      return dept;
    }

    for (const alias of dept.legacyAliases) {
      const aliasKey = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKey === aliasKey) {
        return dept;
      }
    }

    for (const issueType of dept.supportedIssueTypes) {
      const issueKey = issueType.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKey === issueKey || (normalizedKey.length > 3 && issueKey.includes(normalizedKey)) || (issueKey.length > 3 && normalizedKey.includes(issueKey))) {
        return dept;
      }
    }

    for (const cat of dept.serviceCategories) {
      const catKey = cat.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedKey === catKey) {
        return dept;
      }
    }
  }

  return null;
}

/**
 * Strict department isolation checker:
 * Checks if a report belongs to a target department ID, either via direct department fields
 * or via category / issue type taxonomy.
 */
export function isReportInDepartment(
  report: { departmentId?: string; department?: string; category?: string; damageType?: string; complaintType?: string },
  targetDeptId?: string | null
): boolean {
  const normTarget = normalizeDepartmentId(targetDeptId);
  if (!normTarget) return false;

  // 1. Direct department field match
  const deptFromField = normalizeDepartmentId(report.departmentId || report.department);
  if (deptFromField === normTarget) return true;

  // 2. Category / damageType / complaintType match
  const catString = report.category || report.damageType || report.complaintType;
  if (catString) {
    const deptFromCategory = normalizeDepartmentId(catString);
    if (deptFromCategory === normTarget) return true;
  }

  return false;
}


/**
 * Normalizes an arbitrary department string into its canonical ID.
 */
export function normalizeDepartmentId(input?: string | null): CanonicalDepartmentId | null {
  return normalizeDepartment(input)?.id ?? null;
}

/**
 * Lookup department definition by ID.
 */
export function getDepartmentById(id?: string | null): DepartmentDefinition | null {
  return normalizeDepartment(id);
}

/**
 * Lookup department definition by display name or alias.
 */
export function getDepartmentByName(name?: string | null): DepartmentDefinition | null {
  return normalizeDepartment(name);
}

/**
 * Resolves both authoritative departmentId and canonical display name from input.
 */
export function toDepartmentDisplayAndId(input?: string | null): {
  department: string;
  departmentId: CanonicalDepartmentId;
} | {
  department: string;
  departmentId?: undefined;
} {
  const dept = normalizeDepartment(input);
  if (dept) {
    return {
      department: dept.name,
      departmentId: dept.id,
    };
  }
  return {
    department: input?.trim() || 'Unassigned',
  };
}

/**
 * Returns strict department-specific roles/designations and skill categories.
 */
export function getDepartmentOptions(deptInput?: string | null) {
  const normId = normalizeDepartmentId(deptInput);

  if (normId === 'dept_sanitation') {
    return {
      designations: [
        'Garbage Truck Driver',
        'Garbage Collector',
        'Sanitation Crew',
        'Sweeper',
        'Waste Segregation Staff',
        'Sanitation Supervisor',
        'Field Sanitation Worker',
      ],
      skills: [
        'Garbage Collection',
        'Sanitation',
        'Waste Management',
        'Street Sweeping',
        'General Maintenance',
      ],
    };
  }

  if (normId === 'dept_engineering' || normId === 'dept_traffic') {
    return {
      designations: [
        'Road Repair Worker',
        'Asphalt Worker',
        'Road Repair Technician',
        'Civil Work Builder',
        'Junior Engineer',
        'Road Maintenance Worker',
      ],
      skills: [
        'Road Repair',
        'Asphalt Work',
        'Civil Works',
        'Footpath Repair',
        'General Maintenance',
      ],
    };
  }

  if (normId === 'dept_electrical') {
    return {
      designations: [
        'Street Light Technician',
        'Electrical Technician',
        'Electrician',
        'Line Technician',
        'Electrical Engineer',
      ],
      skills: [
        'Electrical Maintenance',
        'Streetlight Repair',
        'Power & Wiring',
        'General Maintenance',
      ],
    };
  }

  if (normId === 'dept_water') {
    return {
      designations: [
        'Drainage Cleaner',
        'Pipeline Technician',
        'Plumber',
        'Water Supply Engineer',
        'Pump Operator',
      ],
      skills: [
        'Drainage Cleaning',
        'Pipeline Work',
        'Water Supply',
        'Plumbing Work',
        'General Maintenance',
      ],
    };
  }

  if (normId === 'dept_parks') {
    return {
      designations: [
        'Gardener',
        'Tree Maintenance Worker',
        'Park Supervisor',
        'Environmental Engineer',
      ],
      skills: [
        'Park Maintenance',
        'Tree Trimming',
        'Horticulture',
        'General Maintenance',
      ],
    };
  }

  if (normId === 'dept_public_works') {
    return {
      designations: [
        'Civil Work Builder',
        'Project Manager',
        'Supervisor',
        'Technician',
        'Field Worker',
      ],
      skills: [
        'Civil Works',
        'Public Infrastructure',
        'General Maintenance',
      ],
    };
  }

  // Fallback for general or unassigned
  return {
    designations: [
      'Field Repair Worker',
      'Sanitation Crew',
      'Garbage Truck Driver',
      'Road Repair Worker',
      'Drainage Cleaner',
      'Pipeline Technician',
      'Electrical Technician',
      'Field Supervisor',
    ],
    skills: [
      'General Maintenance',
      'Garbage Collection',
      'Road Repair',
      'Sanitation',
      'Electrical Maintenance',
      'Drainage Cleaning',
    ],
  };
}
