'use client';

import React from 'react';

interface AnimatedHamburgerProps {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  isScrolled?: boolean;
}

export default function AnimatedHamburger({
  isOpen,
  onToggle,
  isScrolled = false,
}: AnimatedHamburgerProps) {
  const barColor = isScrolled ? '#0f172a' : '#ffffff';

  return (
    <div className="flex items-center justify-center cursor-pointer select-none">
      <label className="relative block cursor-pointer p-1.5 focus:outline-none" aria-label="Toggle navigation menu">
        <input
          type="checkbox"
          checked={isOpen}
          onChange={(e) => onToggle(e.target.checked)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 m-0"
          aria-expanded={isOpen}
        />
        <div className="w-[30px] h-[21px] flex flex-col justify-between items-center py-[1px]">
          {/* Bar 1 */}
          <span
            style={{
              backgroundColor: barColor,
              transform: isOpen ? 'translateY(9.5px) rotate(45deg)' : 'none',
              transition: 'all 0.3s cubic-bezier(0.37, -1.11, 0.79, 2.02)',
            }}
            className="block w-[28px] sm:w-[30px] h-[3px] rounded-[40px]"
          />

          {/* Bar 2 */}
          <span
            style={{
              backgroundColor: barColor,
              opacity: isOpen ? 0 : 1,
              transition: 'all 0.3s cubic-bezier(0.37, -1.11, 0.79, 2.02)',
            }}
            className="block w-[28px] sm:w-[30px] h-[3px] rounded-[40px]"
          />

          {/* Bar 3 */}
          <span
            style={{
              backgroundColor: barColor,
              transform: isOpen ? 'translateY(-8px) rotate(-45deg)' : 'none',
              transition: 'all 0.3s cubic-bezier(0.37, -1.11, 0.79, 2.02)',
            }}
            className="block w-[28px] sm:w-[30px] h-[3px] rounded-[40px]"
          />
        </div>
      </label>
    </div>
  );
}
