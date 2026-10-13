import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { en } from "../locales/en";
import { he } from "../locales/he";

export type Lang = "he" | "en";

const STORAGE_KEY = "club-admin-lang";

function storedLang(): Lang {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "en" ? "en" : "he";
}

void i18n.use(initReactI18next).init({
  resources: {
    he: { translation: he },
    en: { translation: en },
  },
  lng: storedLang(),
  fallbackLng: "he",
  interpolation: { escapeValue: false }, // React already escapes
});

function applyLang(lang: string) {
  const dir = lang === "he" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
  document.title = i18n.t("app.title");
}

i18n.on("languageChanged", (lang) => {
  localStorage.setItem(STORAGE_KEY, lang);
  applyLang(lang);
});

applyLang(i18n.language);

export function currentLang(): Lang {
  return i18n.language === "en" ? "en" : "he";
}

/** Pick the current-language variant of a bilingual data value. */
export interface L10n {
  he: string;
  en: string;
}

export function l10n(value: L10n): string {
  return value[currentLang()];
}

export default i18n;
