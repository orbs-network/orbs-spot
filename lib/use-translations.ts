import { useCallback } from "react";
import translations from "./spot-translations.json";

function removeBraced(input: string) {
  let value = input;
  const re = /\{[^{}]*\}/g;

  while (re.test(value)) {
    value = value.replace(re, "");
  }

  return value;
}

type TranslationKey = keyof typeof translations;

export const useTranslations = () => {
  return useCallback(
    (key: string, args?: Record<string, string | number>): string => {
      const value = translations[key as TranslationKey];

      if (!value) {
        return key;
      }

      return removeBraced(
        value.replace(/{(\w+)}/g, (match, name) => {
          const replacement = args?.[name];
          return replacement === undefined ? match : String(replacement);
        })
      );
    },
    []
  );
};
