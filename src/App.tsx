import { useEffect, useMemo, useState } from "react";
import { Layout } from "./app/Layout.tsx";
import { useRoute } from "./app/route.ts";
import { LangContext, detectLang } from "./i18n/index.ts";
import type { Lang } from "./i18n/index.ts";
import { Home } from "./pages/Home.tsx";
import { Placeholder } from "./pages/Placeholder.tsx";
import "./styles/tokens.css";
import "./styles/app.css";

export function App() {
  const [lang, setLang] = useState<Lang>(detectLang);
  const route = useRoute();
  const value = useMemo(() => ({ lang, setLang }), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    document.title = "JD2CV";
  }, [lang]);

  let page;
  switch (route) {
    case "app":
      page = <Placeholder titleKey="page.app" />;
      break;
    case "how":
      page = <Placeholder titleKey="page.how" />;
      break;
    case "faq":
      page = <Placeholder titleKey="page.faq" />;
      break;
    case "contact":
      page = <Placeholder titleKey="page.contact" />;
      break;
    case "privacy":
      page = <Placeholder titleKey="page.privacy" />;
      break;
    default:
      page = <Home />;
  }

  return (
    <LangContext.Provider value={value}>
      <Layout>{page}</Layout>
    </LangContext.Provider>
  );
}
