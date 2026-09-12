'use client';

import {
  HardHat,
  Trash2,
  Zap,
  Droplets,
  Trees,
  Cone,
  Building2,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { normalizeDepartmentId } from '@/lib/departments';

interface DeptIconProps {
  dept?: string | null;
  className?: string;
  fallbackIcon?: LucideIcon;
}

export function getDeptLucideIcon(dept?: string | null): LucideIcon {
  const normId = normalizeDepartmentId(dept);
  if (normId === 'dept_engineering') return HardHat;
  if (normId === 'dept_sanitation') return Trash2;
  if (normId === 'dept_electrical') return Zap;
  if (normId === 'dept_water') return Droplets;
  if (normId === 'dept_parks') return Trees;
  if (normId === 'dept_traffic') return Cone;
  if (normId === 'dept_public_works') return Building2;

  const lower = (dept || '').toLowerCase();
  if (lower.includes('road') || lower.includes('pothole') || lower.includes('civil') || lower.includes('engineer')) return HardHat;
  if (lower.includes('garbage') || lower.includes('waste') || lower.includes('sanitat') || lower.includes('clean')) return Trash2;
  if (lower.includes('light') || lower.includes('electric') || lower.includes('power')) return Zap;
  if (lower.includes('water') || lower.includes('drainage') || lower.includes('pipe')) return Droplets;
  if (lower.includes('park') || lower.includes('tree') || lower.includes('green') || lower.includes('environment')) return Trees;
  if (lower.includes('traffic') || lower.includes('signal')) return Cone;
  if (lower.includes('building') || lower.includes('pwd') || lower.includes('public')) return Building2;

  return ShieldCheck;
}

export function DeptIcon({ dept, className = 'h-5 w-5', fallbackIcon }: DeptIconProps) {
  const IconComponent = fallbackIcon || getDeptLucideIcon(dept);
  return <IconComponent className={className} />;
}
