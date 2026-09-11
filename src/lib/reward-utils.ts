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
  category: 'cash' | 'transit' | 'pmc' | 'voucher';
  title: string;
  provider: string;
  description: string;
  pointsCost: number;
  minQualifiedReports?: number;
  badge: string;
  color: string;
  iconName: 'IndianRupee' | 'Bus' | 'Building2' | 'ShoppingBag' | 'Zap' | 'Gift';
};

export const REWARD_CATALOG: CatalogRewardItem[] = [
  {
    id: 'razorpay-cash-100',
    category: 'cash',
    title: '₹100 Direct Bank Cash Transfer',
    provider: 'Razorpay Instant UPI Payout',
    description: 'Instant direct cash payout to your GPay, PhonePe, or UPI ID.',
    pointsCost: 50,
    minQualifiedReports: 3,
    badge: 'Razorpay Cash',
    color: 'from-emerald-500 to-teal-600',
    iconName: 'IndianRupee',
  },
  {
    id: 'pmpml-bus-pass-50',
    category: 'transit',
    title: 'PMPML Daily Bus Pass 50% Off',
    provider: 'Pune Mahanagar Parivahan',
    description: '50% discount voucher on your next PMPML daily or monthly bus pass.',
    pointsCost: 30,
    badge: 'Transit Pass',
    color: 'from-blue-500 to-indigo-600',
    iconName: 'Bus',
  },
  {
    id: 'pune-metro-pass-10',
    category: 'transit',
    title: 'Pune Metro 10-Ride Pass Discount',
    provider: 'MahaMetro Pune',
    description: 'Get 10 free metro rides across Pune Metro Aqua & Purple lines.',
    pointsCost: 40,
    badge: 'Metro Voucher',
    color: 'from-violet-500 to-purple-600',
    iconName: 'Zap',
  },
  {
    id: 'pmc-tax-rebate-5',
    category: 'pmc',
    title: 'PMC Property Tax 5% Rebate Voucher',
    provider: 'Pune Municipal Corporation',
    description: 'Official municipal tax concession certificate for PMC property tax bills.',
    pointsCost: 100,
    minQualifiedReports: 5,
    badge: 'PMC Official',
    color: 'from-amber-500 to-orange-600',
    iconName: 'Building2',
  },
  {
    id: 'amazon-pay-150',
    category: 'voucher',
    title: '₹150 Amazon Pay Gift Card',
    provider: 'Amazon Pay India',
    description: 'Redeemable for shopping, bill payments, and mobile recharges on Amazon.',
    pointsCost: 45,
    badge: 'Shopping Voucher',
    color: 'from-cyan-500 to-blue-600',
    iconName: 'ShoppingBag',
  },
  {
    id: 'swiggy-zomato-100',
    category: 'voucher',
    title: '₹100 Swiggy & Zomato Coupon',
    provider: 'Swiggy / Zomato Food',
    description: 'Flat ₹100 discount voucher on all food delivery orders across Pune.',
    pointsCost: 25,
    badge: 'Dining Coupon',
    color: 'from-rose-500 to-pink-600',
    iconName: 'Gift',
  },
];

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
