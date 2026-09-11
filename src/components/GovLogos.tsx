'use client';

import React from 'react';

// Ashoka Lion Capital / National Emblem of India SVG
export function NationalEmblem({ className = 'h-14 w-auto' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="National Emblem of India"
    >
      {/* Three Lions Top Crest */}
      <g fill="#2d3748" stroke="#1a202c" strokeWidth="0.5">
        {/* Center Lion Head & Mane */}
        <path d="M60 12 C52 12, 48 18, 48 26 C48 34, 52 38, 60 40 C68 38, 72 34, 72 26 C72 18, 68 12, 60 12 Z" fill="#4a5568" />
        <circle cx="56" cy="22" r="1.5" fill="#1a202c" />
        <circle cx="64" cy="22" r="1.5" fill="#1a202c" />
        <path d="M57 26 Q60 28 63 26" stroke="#1a202c" strokeWidth="1" fill="none" />
        <path d="M52 14 Q60 8 68 14 Q74 20 72 28 Q70 36 60 42 Q50 36 48 28 Q46 20 52 14 Z" stroke="#2d3748" strokeWidth="1" fill="none" />
        
        {/* Left Lion Head & Profile */}
        <path d="M38 18 C32 18, 28 24, 28 32 C28 38, 33 44, 42 46 C44 38, 44 28, 38 18 Z" fill="#4a5568" />
        <circle cx="34" cy="28" r="1.3" fill="#1a202c" />
        <path d="M30 32 Q35 34 38 31" stroke="#1a202c" strokeWidth="0.8" fill="none" />

        {/* Right Lion Head & Profile */}
        <path d="M82 18 C88 18, 92 24, 92 32 C92 38, 87 44, 78 46 C76 38, 76 28, 82 18 Z" fill="#4a5568" />
        <circle cx="86" cy="28" r="1.3" fill="#1a202c" />
        <path d="M90 32 Q85 34 82 31" stroke="#1a202c" strokeWidth="0.8" fill="none" />

        {/* Lions Torso & Paws */}
        <path d="M42 46 L38 78 L50 80 L52 50 L68 50 L70 80 L82 78 L78 46 Z" fill="#4a5568" />
        <path d="M48 50 C48 65, 54 75, 60 78 C66 75, 72 65, 72 50 Z" fill="#718096" opacity="0.4" />
      </g>

      {/* Abacus (Circular Base) */}
      <rect x="22" y="82" width="76" height="18" rx="3" fill="#e2e8f0" stroke="#2d3748" strokeWidth="1.2" />
      
      {/* Ashoka Chakra in Center of Abacus */}
      <g transform="translate(60, 91)">
        <circle cx="0" cy="0" r="7" stroke="#1e3a8a" strokeWidth="1.2" fill="#eff6ff" />
        <circle cx="0" cy="0" r="1.2" fill="#1e3a8a" />
        {/* 24 spokes */}
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => (
          <line
            key={deg}
            x1="0"
            y1="-6.5"
            x2="0"
            y2="6.5"
            stroke="#1e3a8a"
            strokeWidth="0.6"
            transform={`rotate(${deg})`}
          />
        ))}
      </g>

      {/* Bull on Left */}
      <path d="M30 92 C32 89 36 89 38 92 C39 94 37 96 34 96 Z" fill="#4a5568" />
      {/* Horse on Right */}
      <path d="M82 92 C84 89 88 89 90 92 C91 94 89 96 86 96 Z" fill="#4a5568" />

      {/* Bell-shaped Lotus Base */}
      <path d="M26 100 C30 114, 45 120, 60 120 C75 120, 90 114, 94 100 Z" fill="#cbd5e1" stroke="#2d3748" strokeWidth="1" />
      <path d="M36 100 Q60 114 84 100" stroke="#94a3b8" strokeWidth="1" fill="none" />
      
      {/* Satyameva Jayate Inscription in English Romanized */}
      <text
        x="60"
        y="142"
        textAnchor="middle"
        fill="#1e293b"
        fontSize="9.5"
        fontWeight="bold"
        fontFamily="sans-serif"
        letterSpacing="1"
      >
        SATYAMEVA JAYATE
      </text>
    </svg>
  );
}

// Har Ghar Tiranga Logo Badge
export function HarGharTirangaLogo({ className = 'h-11 w-auto' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-orange-200/80 shadow-sm hover:shadow transition-all ${className}`}>
      {/* Tricolor Ribbon Flag */}
      <svg viewBox="0 0 48 36" className="h-8 w-11 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 6 C12 3, 24 10, 36 6 C42 4, 45 6, 45 6 L45 13 C45 13, 40 11, 35 13 C23 17, 12 10, 4 13 Z" fill="#FF9933" />
        <path d="M4 13 C12 10, 23 17, 35 13 C40 11, 45 13, 45 13 L45 20 C45 20, 40 18, 35 20 C23 24, 12 17, 4 20 Z" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="0.5" />
        <path d="M4 20 C12 17, 23 24, 35 20 C40 18, 45 20, 45 20 L45 27 C45 27, 40 25, 35 27 C23 31, 12 24, 4 27 Z" fill="#138808" />
        {/* Flag Pole */}
        <line x1="4" y1="4" x2="4" y2="34" stroke="#475569" strokeWidth="2" strokeLinecap="round" />
        {/* Ashoka Chakra */}
        <circle cx="24" cy="16.5" r="2.8" stroke="#000088" strokeWidth="0.6" fill="none" />
        <circle cx="24" cy="16.5" r="0.6" fill="#000088" />
      </svg>
      <div className="flex flex-col text-left leading-tight">
        <span className="text-[11px] font-black text-orange-600 tracking-tight font-sans">HAR GHAR</span>
        <span className="text-[10px] font-extrabold text-green-700 tracking-wider font-sans">TIRANGA</span>
      </div>
    </div>
  );
}

// Swachh Bharat Abhiyan Logo Badge (Iconic Gandhi Spectacles)
export function SwachhBharatLogo({ className = 'h-11 w-auto' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-white border border-slate-200 shadow-sm hover:shadow transition-all ${className}`}>
      <svg viewBox="0 0 90 40" className="h-7 w-16 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Left lens */}
        <circle cx="22" cy="20" r="14" stroke="#1e293b" strokeWidth="2.5" fill="#f8fafc" />
        {/* Right lens */}
        <circle cx="68" cy="20" r="14" stroke="#1e293b" strokeWidth="2.5" fill="#f8fafc" />
        {/* Bridge */}
        <path d="M36 17 Q45 13 54 17" stroke="#1e293b" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        {/* Side arms */}
        <path d="M8 18 Q4 16 2 12" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M82 18 Q86 16 88 12" stroke="#1e293b" strokeWidth="2" fill="none" strokeLinecap="round" />
        
        {/* Text inside lenses: SWACHH in left, BHARAT in right */}
        <text x="22" y="24" textAnchor="middle" fill="#047857" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
          SWACHH
        </text>
        <text x="68" y="24" textAnchor="middle" fill="#047857" fontSize="8" fontWeight="bold" fontFamily="sans-serif">
          BHARAT
        </text>
      </svg>
      <div className="flex flex-col text-left leading-none">
        <span className="text-[9px] font-bold text-slate-700">Clean India</span>
        <span className="text-[8px] font-semibold text-emerald-700">Mission</span>
      </div>
    </div>
  );
}

// Beti Bachao Beti Padhao Logo Badge
export function BetiBachaoLogo({ className = 'h-11 w-auto' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-rose-200 shadow-sm hover:shadow transition-all ${className}`}>
      <svg viewBox="0 0 44 44" className="h-8 w-8 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Outer Circular Ring with Sun Rays */}
        <circle cx="22" cy="22" r="19" fill="#fff1f2" stroke="#e11d48" strokeWidth="2" />
        <circle cx="22" cy="22" r="14" fill="#ffe4e6" stroke="#f43f5e" strokeWidth="1" />
        
        {/* Girl Child Silhouette in Center */}
        <circle cx="22" cy="15" r="4.5" fill="#e11d48" />
        <path d="M15 28 C15 22, 29 22, 29 28 L27 34 L17 34 Z" fill="#e11d48" />
        {/* Open Book */}
        <path d="M17 31 Q22 29 27 31 L27 35 Q22 33 17 35 Z" fill="#ffffff" stroke="#e11d48" strokeWidth="0.8" />
      </svg>
      <div className="flex flex-col text-left leading-tight">
        <span className="text-[9px] font-bold text-rose-700">BETI BACHAO</span>
        <span className="text-[8px] font-semibold text-rose-900">BETI PADHAO</span>
      </div>
    </div>
  );
}

// International Yoga / Smart Cities Mission Logo Badge
export function SmartCitiesYogaLogo({ className = 'h-11 w-auto' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-sky-200 shadow-sm hover:shadow transition-all ${className}`}>
      <svg viewBox="0 0 44 44" className="h-8 w-8 shrink-0" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Circle with Leaves / Lotus base */}
        <circle cx="22" cy="22" r="19" fill="#f0f9ff" stroke="#0284c7" strokeWidth="1.8" />
        {/* Sun in center */}
        <circle cx="22" cy="17" r="5" fill="#f59e0b" />
        {/* Yoga / Human Figure in Prayer / Lotus */}
        <circle cx="22" cy="14" r="2.2" fill="#0369a1" />
        <path d="M17 26 C17 20, 27 20, 27 26 C25 29, 19 29, 17 26 Z" fill="#0284c7" />
        {/* Leaves at base */}
        <path d="M12 30 C16 26, 22 28, 22 33 C18 33, 14 32, 12 30 Z" fill="#16a34a" />
        <path d="M32 30 C28 26, 22 28, 22 33 C26 33, 30 32, 32 30 Z" fill="#16a34a" />
      </svg>
      <div className="flex flex-col text-left leading-tight">
        <span className="text-[9px] font-bold text-sky-800">SMART CITY</span>
        <span className="text-[8px] font-semibold text-emerald-700">PUNE MISSION</span>
      </div>
    </div>
  );
}

// Pune Municipal Corporation Crest / Seal SVG
export function PMCCrest({ className = 'h-12 w-auto' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Outer Circle with Decorative Border */}
      <circle cx="50" cy="50" r="46" fill="#fef2f2" stroke="#b91c1c" strokeWidth="3" />
      <circle cx="50" cy="50" r="41" fill="#ffffff" stroke="#e11d48" strokeWidth="1.2" strokeDasharray="3 2" />
      
      {/* Shaniwar Wada Fort Bastion Outline (Historic Symbol of Pune) */}
      <path d="M28 66 L28 42 L34 38 L40 42 L40 66 Z" fill="#dc2626" opacity="0.85" />
      <path d="M60 66 L60 42 L66 38 L72 42 L72 66 Z" fill="#dc2626" opacity="0.85" />
      <path d="M38 52 L62 52 L62 66 L38 66 Z" fill="#991b1b" />
      <path d="M44 66 L44 56 C44 53, 56 53, 56 56 L56 66 Z" fill="#fef2f2" />

      {/* Top Sun / Torch */}
      <circle cx="50" cy="28" r="6" fill="#f59e0b" />
      <path d="M46 34 L54 34 L52 42 L48 42 Z" fill="#b45309" />

      {/* River Mula-Mutha Waves below fort */}
      <path d="M22 72 Q36 68 50 72 Q64 76 78 72" stroke="#0284c7" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M24 76 Q37 72 50 76 Q63 80 76 76" stroke="#38bdf8" strokeWidth="1.8" fill="none" strokeLinecap="round" />

      {/* English Inscription arc */}
      <text x="50" y="20" textAnchor="middle" fill="#991b1b" fontSize="6" fontWeight="bold" fontFamily="sans-serif">
        PUNE MUNICIPAL CORP
      </text>
    </svg>
  );
}
