"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { th } from "@/lib/i18n/th";
import { en } from "@/lib/i18n/en";

type Language = "TH" | "EN";
type Dictionary = typeof th;

interface LanguageContextType {
  language: Language;
  t: (key: string) => string;
  toggleLanguage: () => void;
  setLanguage: (lang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "TH",
  t: (key: string) => key,
  toggleLanguage: () => {},
  setLanguage: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>("TH");

  useEffect(() => {
    const savedLang = localStorage.getItem("nexus_language") as Language;
    if (savedLang && (savedLang === "TH" || savedLang === "EN")) {
      setLang(savedLang);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLang(lang);
    localStorage.setItem("nexus_language", lang);
  };

  const toggleLanguage = () => {
    setLanguage(language === "TH" ? "EN" : "TH");
  };

  const t = (key: string): string => {
    const dict: Dictionary = language === "TH" ? th : en;
    const keys = key.split(".");
    let result: any = dict;
    for (const k of keys) {
      if (result[k] === undefined) {
        return key; // fallback to key if not found
      }
      result = result[k];
    }
    return result as string;
  };

  return (
    <LanguageContext.Provider value={{ language, t, toggleLanguage, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
