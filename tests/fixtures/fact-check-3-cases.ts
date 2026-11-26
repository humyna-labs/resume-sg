/* eslint-disable @typescript-eslint/no-non-null-assertion -- indexes are fixed by the fixtures */
// Fixtures for resume-sg#38 (fact-check 3). Synthetic data only.
import type { TailorOutput } from "../../src/ai/types.ts";
import { case2Output } from "./fact-check-cases.ts";

/**
 * Case 2 (Chinese original) with a natural English output: company, title, school and degree rendered in
 * English, skills translated, English tech names (SQL, Excel, Figma) kept, English language names.
 * Sources stay exact substrings of the original. Expected: no red finding for outputLang "en".
 */
export function case2NaturalEnOutput(): TailorOutput {
  const out = case2Output();
  const r = out.resume;
  r.basics.name = "Wang Xiaoyu";
  r.basics.headline = "Senior user operations, e-commerce growth";
  r.summary =
    "Focused on new-user growth and first-order conversion: planned 12 acquisition campaigns that added 180,000 new registered users, lifted first-order conversion from 6.2% to 9.1%, and raised 30-day recall by 35%.";
  const e = r.experience;
  e[0]!.company = "Qinghe Life";
  e[0]!.title = "Senior User Operations";
  e[0]!.start = "Jul 2021";
  e[0]!.end = "Present";
  e[0]!.bullets[0]!.text =
    "Reworked the first-order flow and landing page together with design; conversion rose from 6.2% to 9.1%.";
  e[0]!.bullets[1]!.text = "Planned 12 acquisition campaigns that added 180,000 new registered users";
  e[0]!.bullets[2]!.text = "Built SMS and push win-back for churned users; 30-day recall up 35%.";
  e[0]!.bullets[3]!.text = "Reviewed data weekly with SQL and dashboards; gave product more than 20 improvement suggestions.";
  e[1]!.company = "Northshore Technology";
  e[1]!.title = "Operations Assistant";
  e[1]!.start = "Jul 2019";
  e[1]!.end = "Jun 2021";
  e[1]!.bullets[0]!.text = "Supported the Southeast Asia site launch and wrote English campaign page copy and schedules.";
  e[1]!.bullets[1]!.text = "Ran 3 A/B tests on the effect of coupon face value on orders.";
  r.education[0]!.school = "Example University of Finance";
  r.education[0]!.degree = "Bachelor of Management, Marketing";
  r.skills = [
    { id: "s1", name: "Data analysis", items: ["SQL", "Excel", "Data dashboards"] },
    { id: "s2", name: "Experiments", items: ["A/B testing"] },
    { id: "s3", name: "Design collaboration", items: ["Figma"] },
  ];
  r.languages = ["English (working language)", "Mandarin (native)"];
  out.changes = [{ where: "summary", what: "Rewritten in English." }];
  return out;
}
