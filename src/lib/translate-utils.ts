'use client';

export const SUPPORTED_TRANSLATE_LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা' },
  { code: 'pa', label: 'Punjabi', nativeLabel: 'ਪੰਜਾਬੀ' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو' },
] as const;

const LANGUAGE_COOKIE_KEY = 'googtrans';
const LOCAL_STORAGE_KEY = 'parivartan:language';

function setTranslateCookie(languageCode: string) {
  if (typeof document === 'undefined') return;
  
  // Clear existing cookies
  const host = window.location.hostname;
  const domains = ['', `.${host}`, host];
  
  if (languageCode === 'en' || !languageCode) {
    domains.forEach((d) => {
      const domainPart = d ? `;domain=${d}` : '';
      document.cookie = `${LANGUAGE_COOKIE_KEY}=;path=/${domainPart};expires=Thu, 01 Jan 1970 00:00:00 GMT`;
      document.cookie = `${LANGUAGE_COOKIE_KEY}=;path=/;expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    });
  } else {
    document.cookie = `${LANGUAGE_COOKIE_KEY}=/en/${languageCode};path=/;max-age=31536000`;
    if (host) {
      document.cookie = `${LANGUAGE_COOKIE_KEY}=/en/${languageCode};path=/;domain=${host};max-age=31536000`;
    }
  }
}

export function getStoredLanguage() {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LOCAL_STORAGE_KEY) ?? 'en';
}

export function saveLanguage(languageCode: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LOCAL_STORAGE_KEY, languageCode);
  setTranslateCookie(languageCode);
}

export const triggerTranslation = (lang: string, retries = 10) => {
  if (typeof window === 'undefined') return;

  saveLanguage(lang);

  const attempt = (remaining: number) => {
    const select = document.querySelector('.goog-te-combo') as HTMLSelectElement | null;

    if (!select) {
      if (remaining > 0) {
        window.setTimeout(() => attempt(remaining - 1), 300);
      } else if (lang === 'en') {
        // Fallback: If combo is not found and user wants English, reload to clear translation
        window.location.reload();
      }
      return;
    }

    if (lang === 'en') {
      // Clear cookie
      setTranslateCookie('en');

      // Try selecting empty string or 'en'
      if (select.value !== '' && select.value !== 'en') {
        select.value = '';
        select.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Also try resetting via Google Translate banner close button if present
        try {
          const iframe = document.querySelector('iframe.goog-te-banner-frame') as HTMLIFrameElement | null;
          if (iframe?.contentDocument) {
            const closeBtn = iframe.contentDocument.querySelector('.goog-close-link, #goog-gt-tt-close, a[id*="close"]') as HTMLElement | null;
            closeBtn?.click();
          }
        } catch {
          // ignore iframe security errors
        }

        // If not reverted, dispatch 'en'
        window.setTimeout(() => {
          if (select.value !== '' && select.value !== 'en') {
            select.value = 'en';
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
          // If still translated, perform hard reload to restore original English DOM
          window.setTimeout(() => {
            const hasTranslatedClass = document.documentElement.classList.contains('translated-ltr') || document.documentElement.classList.contains('translated-rtl');
            if (hasTranslatedClass) {
              window.location.reload();
            }
          }, 300);
        }, 150);
      }
      return;
    }

    // Changing to non-English language (e.g. 'mr', 'hi')
    if (select.value !== lang) {
      select.value = lang;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  attempt(retries);
};