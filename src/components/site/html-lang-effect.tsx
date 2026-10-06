"use client";

import { useEffect } from "react";

/**
 * Sets <html lang/dir> for localized routes (Urdu RTL, §11.2) and restores
 * the document defaults when the route unmounts. Only the root layout may
 * render the <html> element, so route-level locale attributes are applied
 * as a side effect.
 */
export function HtmlLangEffect({ lang, dir }: { lang: string; dir: "rtl" | "ltr" }) {
  useEffect(() => {
    const prevLang = document.documentElement.lang;
    const prevDir = document.documentElement.getAttribute("dir");
    document.documentElement.lang = lang;
    document.documentElement.setAttribute("dir", dir);
    return () => {
      document.documentElement.lang = prevLang || "en";
      if (prevDir) {
        document.documentElement.setAttribute("dir", prevDir);
      } else {
        document.documentElement.removeAttribute("dir");
      }
    };
  }, [lang, dir]);
  return null;
}
