import { useEffect, useMemo, useState } from "react";
import { Layout } from "./app/Layout.tsx";
import { useRoute } from "./app/route.ts";
import { LangContext, detectLang, dictionaries } from "./i18n/index.ts";
import type { Lang } from "./i18n/index.ts";
import { Home } from "./pages/Home.tsx";
import { Contact } from "./pages/Contact.tsx";
import { Faq } from "./pages/Faq.tsx";
import { HowItWorks } from "./pages/HowItWorks.tsx";
import { AppPage } from "./pages/AppPage.tsx";
import { Disclaimer } from "./pages/Disclaimer.tsx";
import { Templates } from "./pages/Templates.tsx";
import { Privacy } from "./pages/Privacy.tsx";
import "./styles/tokens.css";
import "./styles/app.css";

export function App() {
  const [lang, setLang] = useState<Lang>(detectLang);
  const route = useRoute();
  const value = useMemo(() => ({ lang, setLang }), [lang]);

  useEffect(() => {
    document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";
    const zh = lang === "zh";
    document.title = zh ? "JD2CV · 对岗简历" : "JD2CV";
    let meta = document.head.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = `${zh ? "JD2CV · 对岗简历：" : "JD2CV: "}${dictionaries[lang]["home.sub"]}`;
  }, [lang]);

  let page;
  switch (route) {
    case "app":
      page = <AppPage />;
      break;
    case "how":
      page = <HowItWorks />;
      break;
    case "faq":
      page = <Faq />;
      break;
    case "contact":
      page = <Contact />;
      break;
    case "privacy":
      page = <Privacy />;
      break;
    case "disclaimer":
      page = <Disclaimer />;
      break;
    case "templates":
      page = <Templates />;
      break;
    case "sections":
      page = <Templates heavy />;
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
