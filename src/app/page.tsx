'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Home,
  FileText,
  MapPin,
  Phone,
  Send,
  Users,
  HardHat,
  BarChart3,
  Bot,
  Camera,
  CheckCircle,
  Flag,
  GaugeCircle,
  Trophy,
  AlertTriangle,
  ExternalLink,
  Clock,
  Sparkles,
  ShieldCheck,
  Menu,
  X,
  ChevronDown,
  Layers,
  Activity,
  Info,
  Check,
  Eye,
  Globe2,
  Building2,
  Radio,
  SlidersHorizontal,
  Flame,
  Award,
  Zap,
  Calendar,
  Share2,
  MessageSquare,
  Accessibility,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useUser, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { User as UserProfile } from '@/lib/types';
import GoogleTranslate from '@/components/GoogleTranslate';
import { saveLanguage, triggerTranslation, getStoredLanguage } from '@/lib/translate-utils';
import AnimatedHamburger from '@/components/AnimatedHamburger';
import dynamic from 'next/dynamic';

const PuneBoundaryMap = dynamic(() => import('@/components/maps/PuneBoundaryMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[360px] sm:min-h-[420px] rounded-2xl bg-slate-100 animate-pulse flex items-center justify-center text-slate-400 text-xs font-semibold">
      Loading Pune Municipal Corporation Boundary Map...
    </div>
  ),
});

const featureCards = [
  {
    icon: <Camera className="h-8 w-8 text-emerald-600" />,
    title: 'AI Visual Reporting',
    description:
      'Capture a photo or video of a civic issue. AI identifies the issue category, such as potholes, garbage, drainage, or streetlights, and helps determine its priority.',
  },
  {
    icon: <MessageSquare className="h-8 w-8 text-green-600" />,
    title: 'WhatsApp Complaint Reporting',
    description:
      'Report a civic issue directly through WhatsApp by sending a photo and location. The system automatically creates a complaint, reducing the need for manual form filling.',
  },
  {
    icon: <Share2 className="h-8 w-8 text-blue-600" />,
    title: 'Smart Complaint Routing',
    description:
      'AI-assisted routing sends complaints to the appropriate department and ward based on the issue type, location, priority, and available resources.',
  },
  {
    icon: <Layers className="h-8 w-8 text-indigo-600" />,
    title: 'Duplicate Complaint Detection',
    description:
      'Identify multiple reports of the same issue based on location, category, and submitted media, helping municipal teams avoid duplicate processing and unnecessary work.',
  },
  {
    icon: <GaugeCircle className="h-8 w-8 text-amber-600" />,
    title: 'Live Complaint Tracking',
    description:
      'Citizens can track their complaint from submission to resolution, including assignment, work progress, and closure status, with notifications at important stages.',
  },
  {
    icon: <Flame className="h-8 w-8 text-rose-600" />,
    title: 'Ward Heatmap & Analytics',
    description:
      'Interactive GIS maps visualize complaint hotspots, issue density, recurring problems, and resolution trends to help officials prioritize resources and identify problem areas.',
  },
  {
    icon: <ShieldCheck className="h-8 w-8 text-teal-600" />,
    title: 'Verified Before & After Proof',
    description:
      'Field teams or supervisors upload before-and-after images with location and timestamp information. Officers can review the evidence before closing a complaint, while citizens can provide feedback on the resolution.',
  },
  {
    icon: <HardHat className="h-8 w-8 text-purple-600" />,
    title: 'AI-Assisted Worker Assignment',
    description:
      'Recommend suitable field teams or supervisors based on complaint location, priority, workload, and availability, helping reduce assignment delays and improve resource utilization.',
  },
  {
    icon: <Trophy className="h-8 w-8 text-yellow-600" />,
    title: 'Civic Points & Rewards',
    description:
      'Citizens earn points for verified, non-duplicate civic reports and participation. Points can support leaderboards, recognition, and future reward partnerships with municipal services or local businesses.',
  },
];

const reportingSteps = [
  {
    step: '01',
    badge: 'Instant Capture',
    title: 'Submit Photo & Location',
    description:
      'Citizens submit a photo or video of a civic issue. Location is automatically captured through GPS, with an option to confirm or correct the location.',
  },
  {
    step: '02',
    badge: 'AI Analysis & Smart Routing',
    title: 'Categorization & Ward Assignment',
    description:
      'AI identifies the issue type — such as potholes, drainage, garbage, or streetlight problems — and assigns the complaint to the appropriate department and ward for review.',
  },
  {
    step: '03',
    badge: 'Field Action',
    title: 'Worker / Supervisor Assignment',
    description:
      'The concerned officer assigns the complaint to a field team or supervisor based on location, priority, workload, and availability. The field team carries out the required maintenance work.',
  },
  {
    step: '04',
    badge: 'Verification & Closure',
    title: 'Before/After Verification',
    description:
      'The field team uploads an "After" photo as proof of resolution. AI-assisted verification compares the before and after images, while the officer can review and close the complaint. The citizen receives a status notification and can provide feedback.',
  },
];

const teamMembers = [
  'Aditya Suryawanshi',
  'Vaishnavi Kharpase',
  'Himanshu Patil',
  'Sneha Gurav',
  'Aaditya Hande',
];

const newsAnnouncements = [
  'Active 48-Hour SLA road repair and pothole maintenance drive across all 15 Pune ward offices.',
  '24x7 Citizen Grievance Redressal Helpline: 1800-123-4567 is active and operational.',
  'Mula-Mutha River Restoration, hyacinth removal & zero waste management drive in progress.',
  'PMC committed to resolving all citizen civic reports within guaranteed 48-hour SLA timeframe.',
  'Parivartan PWA mobile app available with offline support and AI-assisted defect reporting.',
];

export default function LandingPage() {
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  function getPortalPath(role?: UserProfile['role']): string {
    if (role === 'worker') return '/worker/dashboard';
    if (role === 'official' || role === 'department_head') return '/smc/dashboard';
    return '/citizen/dashboard';
  }

  // Redirect to correct portal if user has visited before
  useEffect(() => {
    if (!isUserLoading && !isProfileLoading && user && userProfile !== undefined) {
      const hasVisitedBefore = localStorage.getItem('parivartan_visited');
      if (hasVisitedBefore) {
        router.push(getPortalPath(userProfile?.role));
      } else {
        localStorage.setItem('parivartan_visited', 'true');
      }
    }
  }, [user, isUserLoading, userProfile, isProfileLoading, router]);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const yOffset = -80; // Offset for fixed navbar
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
    setMobileMenuOpen(false);
  };



  const [isScrolled, setIsScrolled] = useState(false);
  const [currentLang, setCurrentLang] = useState('en');
  const [langDropdownOpen, setLangDropdownOpen] = useState(false);

  useEffect(() => {
    setCurrentLang(getStoredLanguage());

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 160);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLanguageChange = (lang: string) => {
    setCurrentLang(lang);
    triggerTranslation(lang);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100 selection:bg-rose-500 selection:text-white">
      <GoogleTranslate />

      {/* TOP NAVBAR (Transparent at start, White on Scroll with Logo Appearance) */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 w-full transition-all duration-300 ${isScrolled
            ? 'bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-md text-slate-900 py-2.5'
            : 'bg-transparent border-b border-transparent text-white py-4'
          }`}
      >
        <div className="max-w-7xl mx-auto flex h-14 sm:h-16 items-center justify-between px-4 sm:px-6">
          {/* Left: Appears only on scroll (PMC Logo + Parivartan + PUNE MUNICIPAL CORPORATION) */}
          <Link
            href="/"
            className={`flex items-center gap-3 group transition-all duration-300 ${isScrolled
                ? 'opacity-100 translate-x-0 pointer-events-auto'
                : 'opacity-0 -translate-x-4 pointer-events-none'
              }`}
          >
            <div className="relative h-10 w-10 shrink-0 drop-shadow-sm">
              <Image
                src="/landing-images/pmc-logo.png"
                alt="PMC Seal"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-slate-900 leading-none block">
                Parivartan
              </span>
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-rose-600 block mt-0.5">
                Pune Municipal Corporation
              </span>
            </div>
          </Link>

          {/* Center / Right: Menu Bar Button & Language Switcher */}
          <div className="flex items-center gap-3">
            {/* White-Themed Language Dropdown Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLangDropdownOpen(!langDropdownOpen)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all border shadow-xs ${isScrolled
                    ? 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                    : 'bg-white/15 hover:bg-white/25 backdrop-blur-md border-white/20 text-white'
                  }`}
                aria-label="Select Language"
              >
                <span>Language: <strong className="font-bold">{currentLang === 'mr' ? 'मराठी' : 'English'}</strong></span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${langDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* White Theme Dropdown Menu with English & Marathi */}
              {langDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-44 rounded-xl bg-white border border-slate-200 shadow-2xl p-1.5 flex flex-col gap-1 z-50 text-slate-900 animate-in fade-in-0 zoom-in-95 duration-150">
                  <button
                    onClick={() => {
                      handleLanguageChange('en');
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors ${currentLang === 'en'
                        ? 'bg-rose-50 text-rose-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                  >
                    <span>English</span>
                    {currentLang === 'en' && <Check className="w-3.5 h-3.5 text-rose-600" />}
                  </button>

                  <button
                    onClick={() => {
                      handleLanguageChange('mr');
                      setLangDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold flex items-center justify-between transition-colors ${currentLang === 'mr'
                        ? 'bg-rose-50 text-rose-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                  >
                    <span>मराठी (Marathi)</span>
                    {currentLang === 'mr' && <Check className="w-3.5 h-3.5 text-rose-600" />}
                  </button>
                </div>
              )}
            </div>

            {/* Animated Hamburger Menu Button (No text, no background box) */}
            <div className="flex items-center justify-center p-1">
              <AnimatedHamburger
                isOpen={mobileMenuOpen}
                onToggle={(open) => setMobileMenuOpen(open)}
                isScrolled={isScrolled}
              />
            </div>
          </div>
        </div>

        {/* Dedicated Vertical Menu Dropdown (White background, no icons, text only) */}
        {mobileMenuOpen && (
          <>
            {/* Backdrop click dismisser */}
            <div
              className="fixed inset-0 z-40 bg-transparent"
              onClick={() => setMobileMenuOpen(false)}
            />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
              <div className="absolute right-4 sm:right-6 top-2 w-64 rounded-2xl p-2 bg-white border border-slate-200 shadow-2xl flex flex-col gap-1 animate-in fade-in-0 zoom-in-95 duration-200 z-50 text-slate-900">
                {/* 1. Home */}
                <button
                  onClick={() => {
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm text-slate-800 hover:text-rose-600 hover:bg-slate-50 transition-colors"
                >
                  Home
                </button>

                {/* 2. How It Works */}
                <button
                  onClick={() => {
                    scrollToSection('how-it-works');
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm text-slate-800 hover:text-rose-600 hover:bg-slate-50 transition-colors"
                >
                  How It Works
                </button>

                {/* 3. Citizen Services */}
                <button
                  onClick={() => {
                    scrollToSection('features');
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm text-slate-800 hover:text-rose-600 hover:bg-slate-50 transition-colors"
                >
                  Citizen Services
                </button>

                {/* 4. Portals */}
                <button
                  onClick={() => {
                    scrollToSection('portals');
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm text-slate-800 hover:text-rose-600 hover:bg-slate-50 transition-colors"
                >
                  Role Portals
                </button>

                {/* 5. About PMC & Map */}
                <button
                  onClick={() => {
                    scrollToSection('about-pmc');
                  }}
                  className="w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm text-slate-800 hover:text-rose-600 hover:bg-slate-50 transition-colors"
                >
                  About PMC & Map
                </button>
              </div>
            </div>
          </>
        )}
      </header>

      {/* HERO SECTION WITH AUTHENTIC PMC LOGO & GOV PORTAL DESIGN */}
      <section className="relative w-full min-h-[520px] sm:min-h-[580px] md:min-h-[640px] flex flex-col justify-center items-center overflow-hidden bg-slate-950 py-16 sm:py-20">
        {/* Background Overlay with Pune Civic Image & Higher Brightness / Opacity */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/landing-images/pmc.png"
            alt="Pune Municipal Corporation Headquarters"
            fill
            priority
            className="object-cover object-center brightness-[0.75] contrast-105 scale-105"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-slate-950/45 to-slate-950/85" />
          {/* Subtle animated light gradient glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-rose-600/15 blur-[120px] rounded-full pointer-events-none" />
        </div>

        {/* CENTER HERO CONTENT WITH PMC LOGO & BOLD BRANDING */}
        <div className="relative z-20 max-w-5xl mx-auto px-4 text-center my-auto">
          {/* Official PMC Crest Logo */}
          <div className="flex justify-center mb-6">
            <div className="relative h-28 sm:h-32 md:h-36 w-28 sm:w-32 md:w-36 drop-shadow-[0_16px_32px_rgba(0,0,0,0.85)] hover:scale-105 transition-transform duration-300">
              <Image
                src="/landing-images/pmc-logo.png"
                alt="Pune Municipal Corporation Official Seal"
                fill
                priority
                className="object-contain"
              />
            </div>
          </div>

          {/* Main Title Block: Clean Parivartan */}
          <div className="flex justify-center">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white font-sans drop-shadow-lg">
              Parivartan
            </h1>
          </div>

          {/* Subtitle: Municipal Corporation Headline */}
          <p className="mt-3 text-base sm:text-xl md:text-2xl font-extrabold text-slate-200 tracking-wide drop-shadow-md">
            Pune Municipal Corporation
          </p>

          {/* Tagline: Where Government Information Converges -> Civic Redressal Converges */}
          <p className="mt-2.5 text-xs sm:text-sm md:text-base text-slate-300 font-medium max-w-2xl mx-auto leading-relaxed drop-shadow-sm">
            Where Citizen Civic Redressal & Rapid Municipal Action Converge
          </p>
        </div>
      </section>

      {/* NEWS & ANNOUNCEMENT TICKER */}
      <div className="bg-slate-950 text-slate-200 py-3.5 px-4 border-b border-slate-800 flex items-center gap-3 overflow-hidden text-xs font-medium">
        <div className="max-w-7xl mx-auto w-full flex items-center gap-3">
          <div className="shrink-0 flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wide">
            <Radio className="w-3.5 h-3.5 text-amber-300 animate-pulse" />
            PMC LIVE
          </div>
          <div className="flex-1 overflow-hidden whitespace-nowrap">
            <div className="inline-block animate-[marquee_28s_linear_infinite] hover:[animation-play-state:paused]">
              {newsAnnouncements.map((news, idx) => (
                <span key={idx} className="mr-12 inline-flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"></span>
                  <span>{news}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <main id="main-content" className="flex-1 bg-slate-50 text-slate-900">
        {/* 1. 4-STEP RESOLUTION LIFECYCLE (HOW IT WORKS) */}
        <section id="how-it-works" className="py-16 md:py-24 bg-slate-50 border-b border-slate-200 scroll-mt-20 sm:scroll-mt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-extrabold uppercase tracking-wider text-blue-700 bg-blue-100 px-4 py-1.5 rounded-full border border-blue-200">
                Resolution Process
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mt-3 tracking-tight">
                From Report to Resolution
              </h2>
              <p className="text-slate-600 text-sm sm:text-base mt-2">
                A transparent, AI-assisted lifecycle that helps municipal teams process, assign, resolve, and verify civic complaints.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
              {reportingSteps.map((step) => (
                <div
                  key={step.step}
                  className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 shadow-md hover:shadow-xl transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                        {step.step}
                      </span>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        {step.badge}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">{step.title}</h3>
                    <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. PLATFORM FEATURES GRID (CITIZEN SERVICES) */}
        <section id="features" className="py-16 md:py-24 bg-white border-b border-slate-200 scroll-mt-20 sm:scroll-mt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-4 py-1.5 rounded-full border border-emerald-200">
                Platform Capabilities
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mt-3 tracking-tight">
                Smart Governance & Civic Intelligence
              </h2>
              <p className="text-slate-600 text-sm sm:text-base mt-2">
                AI-powered reporting, automated complaint processing, geospatial intelligence, and transparent resolution tracking designed to improve municipal service delivery.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featureCards.map((feat, index) => (
                <div
                  key={index}
                  className="p-6 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-300 shadow-md hover:shadow-xl transition-all"
                >
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mb-4 shadow-xs">
                    {feat.icon}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{feat.title}</h3>
                  <p className="text-xs text-slate-600 leading-relaxed">{feat.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. FOUR OFFICIAL ROLE PORTALS GATEWAY (IN LAST) */}
        <section id="portals" className="py-16 md:py-24 bg-slate-50 border-b border-slate-200 scroll-mt-20 sm:scroll-mt-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-700 bg-rose-100 px-4 py-1.5 rounded-full border border-rose-200">
                Choose Your Role Portal
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 mt-3 tracking-tight">
                Choose Your Role Portal
              </h2>
              <p className="text-slate-600 text-sm sm:text-base mt-3">
                Dedicated digital interfaces tailored for citizens, maintenance field workers, PMC administrative officers, and department heads.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Portal 1: Citizen Portal */}
              <div className="flex flex-col bg-white rounded-2xl border-2 border-emerald-200 hover:border-emerald-500 shadow-md hover:shadow-2xl transition-all duration-300 p-6 hover:-translate-y-1 group">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform mb-5">
                  <Users className="w-7 h-7" />
                </div>
                <div className="inline-block self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
                  Citizen Services
                </div>
                <h3 className="text-xl font-bold text-slate-900">Citizen Portal</h3>
                <p className="text-xs text-slate-500 font-semibold mb-3">Pune Residents</p>
                <p className="text-xs text-slate-600 leading-relaxed flex-1">
                  Report road potholes, garbage dumps, drainage, or street lights with live GPS photos. Track real-time progress and earn civic karma points.
                </p>
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                  <Button asChild className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white font-bold h-11 rounded-xl shadow-md">
                    <Link href="/citizen/login">Citizen Login</Link>
                  </Button>
                </div>
              </div>

              {/* Portal 2: Field Worker Portal */}
              <div className="flex flex-col bg-white rounded-2xl border-2 border-orange-200 hover:border-orange-500 shadow-md hover:shadow-2xl transition-all duration-300 p-6 hover:-translate-y-1 group">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform mb-5">
                  <HardHat className="w-7 h-7" />
                </div>
                <div className="inline-block self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200 mb-2">
                  Field Operations
                </div>
                <h3 className="text-xl font-bold text-slate-900">Worker Portal</h3>
                <p className="text-xs text-slate-500 font-semibold mb-3">Maintenance Crew</p>
                <p className="text-xs text-slate-600 leading-relaxed flex-1">
                  View assigned tasks, navigate directly via GPS coordinates, execute road repairs, and upload verified &quot;After&quot; resolution photos.
                </p>
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                  <Button asChild className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-bold h-11 rounded-xl shadow-md">
                    <Link href="/worker/login">Worker Login</Link>
                  </Button>
                </div>
              </div>

              {/* Portal 3: PMC Admin Officer Portal */}
              <div className="flex flex-col bg-white rounded-2xl border-2 border-blue-200 hover:border-blue-500 shadow-md hover:shadow-2xl transition-all duration-300 p-6 hover:-translate-y-1 group">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform mb-5">
                  <BarChart3 className="w-7 h-7" />
                </div>
                <div className="inline-block self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 mb-2">
                  Administration
                </div>
                <h3 className="text-xl font-bold text-slate-900">PMC Admin Portal</h3>
                <p className="text-xs text-slate-500 font-semibold mb-3">Ward Officers & Engineers</p>
                <p className="text-xs text-slate-600 leading-relaxed flex-1">
                  Verify grievance severity, assign maintenance contractors, monitor ward-level GIS heatmaps, and approve verified task closures.
                </p>
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                  <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold h-11 rounded-xl shadow-md">
                    <Link href="/smc/login">Admin Officer Login</Link>
                  </Button>
                </div>
              </div>

              {/* Portal 4: Department Head Portal */}
              <div className="flex flex-col bg-white rounded-2xl border-2 border-purple-200 hover:border-purple-500 shadow-md hover:shadow-2xl transition-all duration-300 p-6 hover:-translate-y-1 group">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center text-white shadow-md group-hover:scale-105 transition-transform mb-5">
                  <Building2 className="w-7 h-7" />
                </div>
                <div className="inline-block self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200 mb-2">
                  Executive Oversight
                </div>
                <h3 className="text-xl font-bold text-slate-900">Dept Head Portal</h3>
                <p className="text-xs text-slate-500 font-semibold mb-3">Department Leadership</p>
                <p className="text-xs text-slate-600 leading-relaxed flex-1">
                  Monitor department-wide SLA compliance rates, track automated escalation triggers, inspect contractor quality, and review analytics.
                </p>
                <div className="mt-6 pt-4 border-t border-slate-100 space-y-2">
                  <Button asChild className="w-full bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 text-white font-bold h-11 rounded-xl shadow-md">
                    <Link href="/dept/login">Dept Head Login</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. ABOUT PMC & PUNE MUNICIPAL MAP SECTION (IN LAST) */}
        <section id="about-pmc" className="py-16 md:py-20 bg-gradient-to-br from-slate-100 via-sky-50/40 to-slate-200 border-b border-slate-300 relative overflow-hidden scroll-mt-20 sm:scroll-mt-24">
          {/* Subtle civic watermark pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:20px_20px] opacity-40 pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Parivartan Citizen Login & WhatsApp Chatbot Cards */}
              <div className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-row items-center justify-center gap-6">
                {/* 1. Parivartan Citizen Login Option */}
                <div className="flex-1 w-full max-w-[240px] bg-white rounded-2xl p-5 border border-slate-300/80 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-between text-center group">
                  <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-xl bg-slate-50 border-2 border-slate-200 p-3 flex flex-col items-center justify-center shadow-inner group-hover:border-rose-400 transition-colors">
                    {/* QR Styled Graphic Frame */}
                    <div className="absolute inset-2 border border-dashed border-slate-300 rounded-lg pointer-events-none" />
                    <div className="relative h-14 w-14 mb-2 drop-shadow-sm group-hover:scale-110 transition-transform">
                      <Image
                        src="/landing-images/pmc-logo.png"
                        alt="PMC Logo"
                        fill
                        className="object-contain"
                      />
                    </div>
                    <Button
                      asChild
                      size="sm"
                      className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-8 px-3 rounded-lg shadow-sm w-full mt-1"
                    >
                      <Link href="/citizen/login">Citizen Login</Link>
                    </Button>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-sm font-black text-slate-900 tracking-wide uppercase">
                      Parivartan
                    </h4>
                    <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                      Citizen Login
                    </p>
                  </div>
                </div>

                {/* 2. WhatsApp Chatbot Card (With COMING SOON text) */}
                <div className="flex-1 w-full max-w-[240px] bg-white rounded-2xl p-5 border border-slate-300/80 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col items-center justify-between text-center group">
                  <div className="relative w-36 h-36 sm:w-40 sm:h-40 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50/50 border-2 border-emerald-200 p-3 flex flex-col items-center justify-center shadow-inner group-hover:border-emerald-400 transition-colors">
                    <div className="absolute inset-2 border border-dashed border-emerald-300/80 rounded-lg pointer-events-none" />

                    {/* WhatsApp Icon */}
                    <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-md mb-2 group-hover:scale-110 transition-transform">
                      <MessageSquare className="w-6 h-6" />
                    </div>

                    {/* COMING SOON Text Badge */}
                    <span className="bg-emerald-700 text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md shadow-xs animate-pulse">
                      Coming Soon
                    </span>
                  </div>

                  <div className="mt-4">
                    <h4 className="text-sm font-black text-slate-900 tracking-wide uppercase">
                      WhatsApp Chatbot
                    </h4>
                    <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mt-0.5">
                      Coming Soon
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column: Pune Municipal Corporation Interactive Map with Dotted City Border */}
              <div className="lg:col-span-7 w-full h-[380px] sm:h-[430px] rounded-2xl overflow-hidden border-2 border-slate-300 bg-white shadow-xl relative">
                <PuneBoundaryMap />
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* CLEAN MODERN FOOTER WITH PMC LOGO */}
      <footer id="contact-footer" className="bg-slate-950 text-slate-300 border-t border-slate-800 pt-12 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-10 border-b border-slate-800">
            {/* Column 1 & 2: Branding & Corporation Info with PMC Logo */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 bg-white/95 rounded-full p-1 shadow-sm flex items-center justify-center">
                  <Image
                    src="/landing-images/pmc-logo.png"
                    alt="Pune Municipal Corporation Logo"
                    fill
                    className="object-contain p-0.5"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight">Parivartan</h3>
                  <p className="text-xs text-rose-400 font-semibold">Pune Municipal Corporation</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Smart City Pune Initiative: An official civic governance platform fostering public participation for clean, safe, and pothole-free roads.
              </p>
            </div>

            {/* Column 3: Quick Navigation */}
            <div>
              <h4 className="font-bold text-white text-sm mb-3 border-b border-slate-800 pb-1.5">
                Quick Links
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="#features" className="hover:text-emerald-400 transition-colors">
                    Citizen Services
                  </Link>
                </li>
                <li>
                  <Link href="#how-it-works" className="hover:text-emerald-400 transition-colors">
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="/citizen/report" className="hover:text-emerald-400 transition-colors">
                    File a Grievance
                  </Link>
                </li>
                <li>
                  <Link href="/sla" className="hover:text-emerald-400 transition-colors">
                    48-Hour SLA Policy
                  </Link>
                </li>
                <li>
                  <Link href="/about-smc" className="hover:text-emerald-400 transition-colors">
                    15 Ward Offices Directory
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Official Portals */}
            <div>
              <h4 className="font-bold text-white text-sm mb-3 border-b border-slate-800 pb-1.5">
                Official Portals
              </h4>
              <ul className="space-y-2 text-xs">
                <li>
                  <Link href="/citizen/login" className="hover:text-emerald-400 transition-colors">
                    Citizen Portal
                  </Link>
                </li>
                <li>
                  <Link href="/worker/login" className="hover:text-orange-400 transition-colors">
                    Worker Portal
                  </Link>
                </li>
                <li>
                  <Link href="/smc/login" className="hover:text-blue-400 transition-colors">
                    Admin Officer Portal
                  </Link>
                </li>
                <li>
                  <Link href="/dept/login" className="hover:text-purple-400 transition-colors">
                    Department Head Portal
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-emerald-400 transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Column 5: Official Contact & Address */}
            <div>
              <h4 className="font-bold text-white text-sm mb-3 border-b border-slate-800 pb-1.5">
                Contact Us
              </h4>
              <ul className="space-y-2.5 text-xs text-slate-400">
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <span>PMC Main Administrative Building, Shivajinagar, Pune - 411005</span>
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                  <a href="tel:18001234567" className="hover:text-white">
                    1800-123-4567 (Toll Free)
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-sky-400 shrink-0" />
                  <a href="mailto:info@punecorporation.org" className="hover:text-white">
                    info@punecorporation.org
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright & Team Modal */}
          <div className="mt-8 pt-4 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center md:text-left">
            <div>
              <p>© {new Date().getFullYear()} Pune Municipal Corporation (PMC). All rights reserved.</p>
              <p className="text-[11px] text-slate-600 mt-1">
                Website Content Managed by Pune Municipal Corporation, Government of Maharashtra.
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs">
              <Dialog open={showTeamModal} onOpenChange={setShowTeamModal}>
                <DialogTrigger asChild>
                  <button className="text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4 cursor-pointer transition-colors">
                    Designed & Developed by Team Parivartan
                  </button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-600" />
                      Team Parivartan
                    </DialogTitle>
                  </DialogHeader>
                  <div className="py-4 space-y-2">
                    <p className="text-xs text-slate-500 mb-3">
                      Smart City Grievance Redressal Platform Contributors:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {teamMembers.map((name, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-slate-100 font-semibold text-slate-800 text-sm flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">
                            {i + 1}
                          </span>
                          {name}
                        </div>
                      ))}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
