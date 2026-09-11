import { NextRequest } from 'next/server';

import { getFirebaseAdmin } from '@/firebase/server';
import type { Report, User as UserProfile } from '@/lib/types';
import { normalizeDepartmentId } from '@/lib/departments';

type SupportedRole = UserProfile['role'];

export class RequestAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
  }
}

export type RequestIdentity = {
  uid: string;
  email: string;
  role: SupportedRole;
  profile: UserProfile;
};

function readBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token || null;
}

export async function requireRequestIdentity(
  request: NextRequest,
  allowedRoles: SupportedRole[] = [],
): Promise<RequestIdentity> {
  const idToken = readBearerToken(request);

  if (!idToken) {
    throw new RequestAuthError('Missing authorization token.', 401);
  }

  const { auth, firestore } = await getFirebaseAdmin();
  const decoded = await auth.verifyIdToken(idToken);

  const userDoc = await firestore.collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) {
    throw new RequestAuthError('User profile not found.', 403);
  }

  const profile = userDoc.data() as UserProfile;
  const role = profile.role;

  if (!role) {
    throw new RequestAuthError('User role is missing.', 403);
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    throw new RequestAuthError('You do not have permission to perform this action.', 403);
  }

  return {
    uid: decoded.uid,
    email: decoded.email || profile.email || '',
    role,
    profile,
  };
}

/**
 * Requires caller to be a department head, official, or admin.
 */
export async function requireDepartmentHead(request: NextRequest): Promise<RequestIdentity> {
  return requireRequestIdentity(request, ['department_head', 'official', 'admin']);
}

/**
 * Ensures caller is a global official or admin.
 */
export function requireGlobalOfficialOrAdmin(identity: RequestIdentity): void {
  if (identity.role !== 'official' && identity.role !== 'admin') {
    throw new RequestAuthError('Global administrative permission required.', 403);
  }
}

/**
 * Verifies caller is assigned to the specified field task.
 */
export function requireWorkerOwnTask(
  report: { assignedWorkerId?: string; assignedContractor?: string },
  identity: { uid: string; name?: string; profile?: UserProfile }
): void {
  const isAssignedByUid = report.assignedWorkerId === identity.uid;
  const isAssignedByName = !!identity.name && report.assignedContractor === identity.name;
  const isAssignedByProfileName = !!identity.profile?.name && report.assignedContractor === identity.profile.name;

  if (!isAssignedByUid && !isAssignedByName && !isAssignedByProfileName) {
    throw new RequestAuthError('Access denied: task is not assigned to you.', 403);
  }
}

/**
 * Verifies caller has access to the target report based on role and canonical departmentId.
 */
export function requireDepartmentAccess(
  report: { departmentId?: string; department?: string; assignedWorkerId?: string; assignedContractor?: string },
  identity: RequestIdentity
): void {
  // Global officials and admins can access all reports
  if (identity.role === 'official' || identity.role === 'admin') {
    return;
  }

  // Department heads are restricted to reports matching their canonical departmentId
  if (identity.role === 'department_head') {
    const userDeptId = normalizeDepartmentId(identity.profile.departmentId || identity.profile.department);
    const reportDeptId = normalizeDepartmentId(report.departmentId || report.department);

    if (!userDeptId || !reportDeptId || userDeptId !== reportDeptId) {
      throw new RequestAuthError('Access denied: report belongs to another department.', 403);
    }
    return;
  }

  // Workers can only access reports assigned specifically to them
  if (identity.role === 'worker') {
    requireWorkerOwnTask(report, identity);
    return;
  }

  throw new RequestAuthError('Access denied.', 403);
}
