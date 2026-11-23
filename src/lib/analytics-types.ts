export type DashboardAnalytics = {
  currency: string;
  totalRevenue: number;
  activeOnlineUsers: number;
  vouchersSold: number;
  vouchersAvailable: number;
  topPackages: Array<{
    packageId: string;
    name: string;
    siteName: string;
    soldCount: number;
    revenue: number;
  }>;
  dailyRevenue: Array<{
    date: string;
    revenue: number;
    transactions: number;
  }>;
};
