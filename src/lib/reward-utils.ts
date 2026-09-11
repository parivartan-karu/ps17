import type { Report } from '@/lib/types';

export type RewardPrizeType = 'coupon' | 'cashback' | 'cash' | 'bus_pass' | 'rail_pass';

export type RewardOffer = {
  qualifiedReports: number;
  prizeType: RewardPrizeType;
  title: string;
  description: string;
  cashEligible: boolean;
};

export type CatalogRewardItem = {
  id: string;
  category: 'transit';
  title: string;
  provider: string;
  description: string;
  pointsCost: number;
  minQualifiedReports?: number;
  badge: string;
  color: string;
  iconName: 'Bus' | 'Train';
};

export const REWARD_CATALOG: CatalogRewardItem[] = [
  {
    id: 'pmpml-bus-pass-150',
    category: 'transit',
    title: 'Daily PMPML Bus Pass',
    provider: 'PMPML Pune',
    description: '1-Day unlimited travel pass across all PMPML Pune city bus routes.',
    pointsCost: 150,
    badge: '150 Score',
    color: 'from-emerald-500 to-teal-600',
    iconName: 'Bus',
  },
  {
    id: 'pune-train-pass-150',
    category: 'transit',
    title: 'Daily Local Railway Train Pass',
    provider: 'Central Railway Pune Division',
    description: '1-Day suburban local train pass for Pune - Lonavala / Talegaon route.',
    pointsCost: 150,
    badge: '150 Score',
    color: 'from-blue-500 to-indigo-600',
    iconName: 'Train',
  },
];

export function isGenuineResolvedReport(report: Report): boolean {
  if (report.status !== 'Resolved') return false;

  const verifiedByAi = report.aiAnalysis?.verificationSuggestion?.toLowerCase().includes('genuine');
  const officialVerified = Array.isArray(report.actionLog) && 
    report.actionLog.some(entry => entry.actor === 'Official');

  return Boolean(verifiedByAi || officialVerified);
}

export function getQualifiedResolvedReportCount(reports: Report[], userId: string): number {
  return reports.filter((report) => report.userId === userId && isGenuineResolvedReport(report)).length;
}

export function getRewardOffer(qualifiedReports: number): RewardOffer | null {
  if (qualifiedReports < 3) return null;

  return {
    qualifiedReports,
    prizeType: 'bus_pass',
    title: 'Transit pass unlocked',
    description: 'You can claim a daily bus or railway pass for your civic contribution.',
    cashEligible: true,
  };
}

export function buildRewardNotificationText(offer: RewardOffer): string {
  return `${offer.title}. You have ${offer.qualifiedReports} verified resolved reports. Claim your daily bus or train pass from the redeem section.`;
}
