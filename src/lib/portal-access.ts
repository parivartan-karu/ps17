import type { User as UserProfile } from '@/lib/types';
import { normalizeDepartmentId } from '@/lib/departments';

export type Portal = 'central' | 'department' | 'worker' | 'citizen';

export function getPortalForRole(role?: UserProfile['role']): Portal | null {
  if (role === 'admin' || role === 'official') return 'central';
  if (role === 'department_head') return 'department';
  if (role === 'worker') return 'worker';
  if (role === 'citizen') return 'citizen';
  return null;
}

export function getPortalHome(role?: UserProfile['role']): string {
  switch (getPortalForRole(role)) {
    case 'central': return '/smc/dashboard';
    case 'department': return '/dept/dashboard';
    case 'worker': return '/worker/dashboard';
    case 'citizen': return '/citizen/dashboard';
    default: return '/';
  }
}

export function isCentralRole(role?: UserProfile['role']): boolean {
  return role === 'admin' || role === 'official';
}

export function isDepartmentRole(role?: UserProfile['role']): boolean {
  return role === 'department_head';
}

export function sameDepartment(a?: UserProfile | null, b?: { departmentId?: string; department?: string } | null): boolean {
  const aId = normalizeDepartmentId(a?.departmentId || a?.department);
  const bId = normalizeDepartmentId(b?.departmentId || b?.department);
  return !!aId && !!bId && aId === bId;
}
