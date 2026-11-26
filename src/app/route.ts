import { useEffect, useState } from "react";

export type Route = "home" | "app" | "how" | "faq" | "contact" | "privacy" | "disclaimer" | "templates";

const MAP: Record<string, Route> = {
  "#/": "home",
  "#/app": "app",
  "#/how-it-works": "how",
  "#/faq": "faq",
  "#/contact": "contact",
  "#/privacy": "privacy",
  "#/disclaimer": "disclaimer",
  "#/templates": "templates",
};

export function parseRoute(hash: string): Route {
  if (hash.startsWith("#/faq/")) return "faq";
  return MAP[hash] ?? "home";
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener("hashchange", on);
    on();
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
