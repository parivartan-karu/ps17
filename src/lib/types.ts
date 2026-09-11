// Type definitions for the Parivartan platform

// ─── Civic Service Registration ───────────────────────────────────────────────

export type CivicServiceCategory = 'garbage' | 'police' | 'hospital' | 'fire' | 'toilet' | 'municipal';

export type CivicServiceStatus = 'pending' | 'approved' | 'rejected';

export type CivicService = {
  id: string;
  category: CivicServiceCategory;
  name: string;
  location: string;          // reverse-geocoded address
  latitude: number;
  longitude: number;
  imageUrl: string;          // base64 data URL (same pattern as reports)
  status: CivicServiceStatus;
  submittedBy: string;       // user uid
  submittedByName: string;
  submittedAt: string;       // ISO timestamp
  reviewedBy?: string;       // admin uid
  reviewedAt?: string;
  rejectionReason?: string;
};

// Department type for hierarchical workflow
export type Department = {
  id: string;
  name: string;
  description?: string;
  headOfficerId?: string; // The department head who manages workers
};

export type User = {
  id: string;
  name: string;
  email: string;
  phoneNumber?: string;
  organization?: string;
  role: 'citizen' | 'official' | 'worker' | 'department_head' | 'admin';
  points: number;
  departmentId?: string; // For workers and department heads
  department?: string; // Department name for quick access
  designation?: string;
  skillType?: string; // e.g., 'Garbage', 'Road Repair', 'Electrical', etc.
  workerRole?: WorkerRole; // New detailed role structure
  assignedContractor?: string;
  wardArea?: string;
  employeeId?: string;
  createdAt?: string;
  // Location data for workers
  currentLocation?: {
    latitude: number;
    longitude: number;
    lastUpdated: string;
  };
  // Assignment tracking
  activeTasks?: number;
  maxTaskCapacity?: number;
  isAvailable?: boolean;
  // Push notification tokens (up to 5 devices)
  fcmTokens?: string[];
  pushNotificationsEnabled?: boolean;
};
export type ReportStatus = 'Submitted' | 'Under Verification' | 'Assigned' | 'In Progress' | 'Resolved' | 'Rejected';
export type WorkerMediaType = 'image' | 'video';
export type WorkerAssignmentStatus = 'Pending' | 'Accepted' | 'Rejected';

export type ActionLogEntry = {
  status: ReportStatus;
  timestamp: string;
  actor: 'Citizen' | 'Official' | 'System' | 'Worker';
  actorName: string;
  notes?: string;
};

export type Report = {
  id: string;
  userId: string;
  userName: string;
  location: string;
  roadName?: string;
  latitude?: number;
  longitude?: number;
  description: string;
  imageUrl: string;
  imageHint: string;
  timestamp: string;
  status: ReportStatus;
  aiAnalysis?: AIAnalysis | null;
  department: string;
  departmentId?: string; // Reference to department for filtering
  category: string;
  remarks?: string;
  causeTag?: string;
  assignedContractor?: string; // Worker name (legacy support)
  assignedWorkerId?: string; // Worker user ID for proper linking
  assignedBy?: string; // Who assigned the task (department head or admin)
  assignmentMethod?: 'auto_assign' | 'admin_assign' | 'admin_override' | 'bulk_assign' | 'queue_assign';
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedResolutionTime?: string;
  afterImageUrl?: string;
  beforeWorkMediaUrl?: string;
  beforeWorkMediaType?: WorkerMediaType;
  beforeWorkUploadedAt?: string;
  beforeWorkNotes?: string;
  afterWorkMediaUrl?: string;
  afterWorkMediaType?: WorkerMediaType;
  afterWorkUploadedAt?: string;
  afterWorkNotes?: string;
  workerAssignmentStatus?: WorkerAssignmentStatus;
  acceptedAt?: string;
  completedAt?: string;
  selfAssigned?: boolean;
  actionLog?: ActionLogEntry[];
  citizenRating?: number;
  citizenFeedback?: string | null;
  workflowStage?: 'pending_admin' | 'pending_department' | 'assigned_worker' | 'in_progress' | 'completed';
  // New assignment system fields
  queuePosition?: number; // Position in department queue
  assignmentHistory?: AssignmentHistory[]; // Track reassignments
  autoAssignmentScore?: number; // Score for matching worker (0-100)
  // Incident linking fields
  linkedIncidentId?: string | null;
  linkedMatchType?: string | null;
  linkedSimilarityScore?: number | null;
  relatedReportCount?: number;
  reportFrequency?: number;
  lastRelatedAt?: string;
  // Illegal Dumping Enforcement fields
  complaintType?: 'Standard' | 'Illegal Dumping';
  illegalDumping?: IllegalDumpingData | null;
};

export type EvidenceQuality = 'good' | 'fair' | 'poor';

export type IllegalDumpingFineDetails = {
  status: 'NOT_ISSUED' | 'PENDING' | 'ISSUED' | 'PAID' | 'DISPUTED' | 'CANCELLED';
  amount?: number;
  violationType?: string;
  noticeNumber?: string;
  issuedBy?: string;
  issuedByName?: string;
  issuedAt?: string;
  notes?: string;
};

export type IllegalDumpingData = {
  detected: boolean;
  confidence: number;                  // 0.0 to 1.0
  wasteType?: string | null;            // e.g., 'Construction Debris', 'Domestic Waste'
  vehicleDetected: boolean;
  vehicleType?: string | null;          // e.g., 'Truck', 'Auto-rickshaw', 'Car', 'Pickup', 'Two-wheeler'
  licensePlateVisible: boolean;
  licensePlateNumber?: string | null;    // Extracted license plate (e.g. 'MH12AB1234' or null)
  croppedPlateUrl?: string | null;
  evidenceQuality: EvidenceQuality;
  reason?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'INSUFFICIENT_EVIDENCE';
  verifiedBy?: string | null;
  verifiedByName?: string | null;
  verifiedAt?: string | null;
  rejectionReason?: string | null;
  fineDetails?: IllegalDumpingFineDetails;
};

export type AIAnalysis = {
  damageDetected: boolean;
  damageCategory: string;
  severity: 'Low' | 'Medium' | 'High';
  verificationSuggestion: 'Likely genuine' | 'Needs manual verification';
  description: string;
  suggestedDepartment:
  | 'Engineering'
  | 'Sanitation'
  | 'Electrical'
  | 'Water Supply'
  | 'Parks & Environment'
  | 'Traffic & Roads'
  | 'Public Works'
  | 'Unassigned';
  suggestedPriority: 'Low' | 'Medium' | 'High' | 'Critical';
  duplicateSuggestion: string;
  suggestedLocationDetails?: string;
  illegalDumping?: {
    detected: boolean;
    confidence: number;
    wasteType?: string | null;
    vehicleDetected: boolean;
    vehicleType?: string | null;
    licensePlateVisible: boolean;
    licensePlateNumber?: string | null;
    evidenceQuality: EvidenceQuality;
    reason?: string;
  } | null;
};

export type Notification = {
  id: string;
  title: string;
  description: string;
  userId?: string;
  imageUrl?: string;
  location?: string;
  locationLink?: string;
  latitude?: number;
  longitude?: number;
  createdAt: string;
  createdBy: string;
  type: 'road_construction' | 'traffic_update' | 'maintenance' | 'general';
  durationMode?: 'fixed' | 'unpredictable';
  durationMinutes?: number;
  expiresAt?: string | null;
  isArchived?: boolean;
  archivedAt?: string;
  archiveReason?: 'duration_elapsed' | 'manual';
  isRead?: boolean;
};

// ===================== NEW WORKER ASSIGNMENT SYSTEM TYPES =====================

// Worker role/designation type
export type WorkerRole = {
  role: string;
  department: string;
  skillLevel?: 'Junior' | 'Senior' | 'Lead';
  certifications?: string[];
};

// Worker availability status
export type WorkerAvailability = {
  workerId: string;
  status: 'Available' | 'Busy' | 'On Break' | 'Offline';
  lastUpdated: string;
  activeTasks: number;
  maxTasks: number;
};

// Worker location for proximity-based assignment
export type WorkerLocation = {
  workerId: string;
  latitude: number;
  longitude: number;
  wardArea?: string;
  lastUpdated: string;
};

// Queue system for department tasks
export type DepartmentQueue = {
  departmentId: string;
  departmentName: string;
  tasks: QueuedTask[];
  averageResolutionTime?: string;
};

export type QueuedTask = {
  reportId: string;
  status: 'Waiting' | 'Assigned' | 'In Progress';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  addedAt: string;
  assignedWorkerId?: string;
};

// Auto-assignment configuration
export type AutoAssignmentConfig = {
  enabled: boolean;
  strategy: 'nearest' | 'least_busy' | 'balanced' | 'custom';
  maxKmRadius: number;
  considerAvailability: boolean;
  considerWorkload: boolean;
  considerLocation: boolean;
  weights?: {
    distanceWeight: number;
    workloadWeight: number;
    availabilityWeight: number;
  };
};

// Admin dashboard assignment view
export type AdminDashboardItem = {
  reportId: string;
  issue: string;
  autoAssignedDept: string;
  autoAssignedDeptId: string;
  autoAssignedWorker?: {
    workerId: string;
    name: string;
    role: string;
    location: string;
    distanceKm: number;
    currentTasks: number;
  };
  actions: 'approve' | 'reassign' | 'override';
  timestamp: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
};

// Bulk assignment payload
export type BulkAssignmentPayload = {
  reportIds: string[];
  department?: string;
  contractor?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
  notes?: string;
  assignedBy: string;
  assignedAt: string;
};

// Overload alert system
export type OverloadAlert = {
  alertId: string;
  departmentId: string;
  departmentName: string;
  pendingTasksCount: number;
  assignedTasksCount: number;
  totalTasksCount: number;
  threshold: number;
  severity: 'Warning' | 'Critical';
  suggestions?: string[];
  generatedAt: string;
};

// Assignment history for tracking
export type AssignmentHistory = {
  id: string;
  reportId: string;
  previousWorkerId?: string;
  newWorkerId: string;
  assignmentMethod: 'auto_assign' | 'admin_assign' | 'admin_override' | 'bulk_assign' | 'queue_assign';
  assignedBy: string;
  reason?: string;
  timestamp: string;
};
