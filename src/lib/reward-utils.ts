import type { Report } from '@/lib/types';

export type RewardPrizeType = 'coupon' | 'cashback' | 'cash' | 'bus_pass' | 'rail_pass';

export type RewardOffer = {
  qualifiedReports: number;
  prizeType: RewardPrizeType;
  title: string;
  description: string;
  cashEligible: boolean;
};

export function isGenuineResolvedReport(report: Report): boolean {
  if (report.status !== 'Resolved') return false;

  // A report is genuine if:
  // 1. AI analysis explicitly verified it as genuine, OR
  // 2. Official explicitly verified it (has official verification action log entry)
  const verifiedByAi = report.aiAnalysis?.verificationSuggestion?.toLowerCase().includes('genuine');
  
  // Check if an official verified this report (look for 'Official' actor in action log)
  const officialVerified = Array.isArray(report.actionLog) && 
    report.actionLog.some(entry => entry.actor === 'Official');

  return Boolean(verifiedByAi || officialVerified);
}

export function getQualifiedResolvedReportCount(reports: Report[], userId: string): number {
  return reports.filter((report) => report.userId === userId && isGenuineResolvedReport(report)).length;
}

export function getRewardOffer(qualifiedReports: number): RewardOffer | null {
  if (qualifiedReports < 3) return null;

  if (qualifiedReports >= 6) {
    return {
      qualifiedReports,
      prizeType: 'cash',
      title: 'Cash reward unlocked',
      description: 'You can claim a cash reward through Razorpay because you have completed more than 2 genuine reports.',
      cashEligible: true,
    };
  }

  if (qualifiedReports >= 5) {
    return {
      qualifiedReports,
      prizeType: 'cashback',
      title: 'Cashback reward unlocked',
      description: 'You can claim a cashback reward for completing multiple genuine reports.',
      cashEligible: true,
    };
  }

  if (qualifiedReports === 4) {
    return {
      qualifiedReports,
      prizeType: 'bus_pass',
      title: 'Transit pass unlocked',
      description: 'You can claim a bus or railway pass for your verified civic contribution.',
      cashEligible: true,
    };
  }

  return {
    qualifiedReports,
    prizeType: 'coupon',
    title: 'Coupon unlocked',
    description: 'You can claim a coupon reward for completing 3 genuine reports.',
      cashEligible: true,
  };
}

export function buildRewardNotificationText(offer: RewardOffer): string {
  const rewardLabel =
    offer.prizeType === 'cash'
      ? 'cash via Razorpay'
      : offer.prizeType === 'cashback'
        ? 'cashback'
        : offer.prizeType === 'bus_pass'
          ? 'bus pass'
          : offer.prizeType === 'rail_pass'
            ? 'railway pass'
            : 'coupon';

  return `${offer.title}. You have ${offer.qualifiedReports} verified resolved reports. Available rewards include coupons, cashback, bus or railway passes, and cash via Razorpay once you cross the 3-report threshold. Claim your ${rewardLabel} from the citizen dashboard.`;
}
