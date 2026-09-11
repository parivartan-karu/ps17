import { Bell, BarChart, FilePlus, HandHeart, HardHat, LayoutDashboard, List, Map, MapPin, MessageSquare, Settings, ShieldAlert, Trophy, User, UserCheck } from 'lucide-react';

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export const navItems: NavItem[] = [
  { href: '/citizen/dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
  { href: '/citizen/report', label: 'Report a Problem', icon: <FilePlus /> },
  { href: '/citizen/my-complaints', label: 'My Complaints', icon: <List /> },
  { href: '/citizen/chatbot', label: 'Chatbot', icon: <MessageSquare /> },
];

export const userNavItems: NavItem[] = [{ href: '/citizen/profile', label: 'Profile', icon: <User /> }];

export const smcNavItems: NavItem[] = [
  { href: '/smc/dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
  { href: '/smc/complaints', label: 'Complaints', icon: <List /> },
  { href: '/smc/illegal-dumping', label: 'Illegal Dumping', icon: <ShieldAlert /> },
  { href: '/smc/contracts', label: 'Contractors', icon: <UserCheck /> },
  { href: '/smc/wards', label: 'Departments', icon: <Map /> },
  { href: '/smc/analytics', label: 'Analytics', icon: <BarChart /> },
  { href: '/smc/civic-services', label: 'Civic Services', icon: <MapPin /> },
  { href: '/smc/notifications', label: 'Alerts', icon: <Bell /> },
  { href: '/smc/settings', label: 'Settings', icon: <Settings /> },
];

export const workerNavItems: NavItem[] = [
  { href: '/worker/dashboard', label: 'Dashboard', icon: <LayoutDashboard /> },
  { href: '/worker/task', label: 'Assigned Tasks', icon: <List /> },
  { href: '/worker/open-tasks', label: 'Open Tasks', icon: <HandHeart /> },
  { href: '/worker/performance', label: 'Performance', icon: <BarChart /> },
  { href: '/worker/history', label: 'History', icon: <Trophy /> },
  { href: '/worker/profile', label: 'Profile', icon: <User /> },
];
