'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Globe2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { getStoredLanguage, saveLanguage, SUPPORTED_TRANSLATE_LANGUAGES, triggerTranslation } from '@/lib/translate-utils';

type LanguageSelectorProps = {
  className?: string;
};

export default function LanguageSelector({ className }: LanguageSelectorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  useEffect(() => {
    const storedLanguage = getStoredLanguage();
    setSelectedLanguage(storedLanguage);

    if (storedLanguage !== 'en') {
      window.setTimeout(() => triggerTranslation(storedLanguage), 500);
    }
  }, []);

  const selected = useMemo(
    () => SUPPORTED_TRANSLATE_LANGUAGES.find((language) => language.code === selectedLanguage) ?? SUPPORTED_TRANSLATE_LANGUAGES[0],
    [selectedLanguage]
  );

  const handleSelect = (languageCode: string) => {
    setSelectedLanguage(languageCode);
    saveLanguage(languageCode);
    triggerTranslation(languageCode);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'h-10 rounded-full border-slate-300/80 bg-white/90 px-3 text-xs font-medium shadow-sm transition-all duration-200 hover:border-emerald-400 hover:bg-emerald-50/70 dark:border-slate-700 dark:bg-slate-900/80 dark:hover:bg-slate-800',
            className
          )}
          aria-label="Select language"
        >
          <Globe2 className="mr-2 h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          {/* notranslate keeps the button label in its own script regardless of active language */}
          <span className="notranslate max-w-28 truncate sm:max-w-36">{selected.nativeLabel}</span>
          <ChevronDown className="ml-2 h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>

      {/* notranslate on the whole content panel so Google Translate never touches these labels */}
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="notranslate w-64 rounded-xl border border-border/80 p-2 shadow-xl"
      >
        <DropdownMenuLabel className="px-2 pb-1 pt-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Language
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1" />

        <div className="max-h-64 overflow-y-auto pr-1">
          {SUPPORTED_TRANSLATE_LANGUAGES.map((language) => {
            const isSelected = language.code === selectedLanguage;

            return (
              <DropdownMenuItem
                key={language.code}
                onClick={() => handleSelect(language.code)}
                className={cn(
                  'flex cursor-pointer items-center justify-between rounded-md px-2.5 py-2 text-xs transition-colors',
                  isSelected && 'bg-emerald-50 font-semibold text-foreground dark:bg-emerald-900/20'
                )}
              >
                <div className="min-w-0 flex items-center gap-2.5">
                  {/* nativeLabel is always in the language's own script — immune to translation */}
                  <span className="notranslate text-sm font-medium">{language.nativeLabel}</span>
                  {language.nativeLabel !== language.label && (
                    <span className="notranslate text-[10px] text-muted-foreground">{language.label}</span>
                  )}
                </div>
                {isSelected && <span className="text-emerald-600 text-sm">✓</span>}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
