'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Eye, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ImageEyeViewerProps {
  src: string;
  alt?: string;
  title?: string;
  badgeLabel?: string;
  heightClass?: string; // e.g. "h-44", "h-48", "h-64"
  className?: string;
  mediaType?: 'image' | 'video';
}

export function ImageEyeViewer({
  src,
  alt = 'Evidence photo',
  title = 'Evidence Media',
  badgeLabel,
  heightClass = 'h-44',
  className = '',
  mediaType = 'image',
}: ImageEyeViewerProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!src) return null;

  if (mediaType === 'video') {
    return (
      <div className={`relative w-full ${heightClass} rounded-xl overflow-hidden border bg-black ${className}`}>
        <video src={src} controls className="w-full h-full object-cover" />
      </div>
    );
  }

  return (
    <>
      <div
        className={`group relative w-full ${heightClass} rounded-xl overflow-hidden border border-slate-200 bg-slate-950 cursor-pointer shadow-sm transition-all hover:shadow-md ${className}`}
        onClick={() => setIsOpen(true)}
      >
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Dark overlay on hover */}
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <div className="flex items-center gap-1.5 bg-black/75 text-white px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border border-white/20 shadow-lg">
            <Eye className="h-4 w-4 text-sky-400" />
            <span>View Full Image</span>
          </div>
        </div>

        {/* Permanent Eye Icon Button top-right */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
          }}
          className="absolute top-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md border border-white/20 transition-all hover:scale-110 hover:bg-black/90 shadow-md z-10"
          title="View Full Photo"
        >
          <Eye className="h-4 w-4 text-sky-400" />
          <span className="sr-only">View photo</span>
        </button>

        {badgeLabel && (
          <Badge className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] backdrop-blur-sm border-0">
            {badgeLabel}
          </Badge>
        )}
      </div>

      {/* Lightbox Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[95vh] p-0 border-0 bg-slate-950 text-white overflow-hidden rounded-2xl shadow-2xl z-50">
          <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-sky-400" />
              <DialogTitle className="text-base font-bold text-white leading-none">{title}</DialogTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-slate-700 bg-slate-800 text-xs text-slate-200 hover:bg-slate-700 hover:text-white"
                asChild
              >
                <a href={src} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Open Raw
                </a>
              </Button>
            </div>
          </DialogHeader>

          <div className="relative w-full h-[70vh] max-h-[750px] bg-slate-950 flex items-center justify-center p-2">
            <Image
              src={src}
              alt={alt}
              fill
              className="object-contain"
              unoptimized
            />
          </div>

          <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>🔍 Full uncropped resolution view</span>
            <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)} className="text-white hover:bg-slate-800">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
