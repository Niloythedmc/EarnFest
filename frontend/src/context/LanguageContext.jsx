/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';
import { translations } from '../translations/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('earnfest_lang');
    if (saved && translations[saved]) return saved;

    const teleLang = window.Telegram?.WebApp?.initDataUnsafe?.user?.language_code;
    if (teleLang) {
      const mapped = teleLang.toLowerCase().split('-')[0];
      if (translations[mapped]) return mapped;
    }
    return 'en';
  });

  const changeLanguage = (lang) => {
    if (translations[lang]) {
      setLanguage(lang);
      localStorage.setItem('earnfest_lang', lang);
    }
  };

  const t = (key) => {
    let result = translations[language];
    
    // Find the key in the top-level or specific key
    if (result && result[key]) return result[key];
    
    // Fallback to English if not found
    return translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
