import { DEFAULT_ORDER } from "./model.ts";
import type { Resume } from "./model.ts";

/** Synthetic person used by the "Load example" button and by tests. */
export function sampleResume(): Resume {
  return {
    basics: {
      name: "Alex Example",
      headline: "Operations Analyst",
      email: "alex@example.com",
      phone: "+65 9000 0000",
      location: "Singapore",
      links: ["linkedin.com/in/alex-example"],
    },
    summary:
      "Operations analyst with six years in logistics, focused on process improvement and clear reporting for warehouse teams.",
    experience: [
      {
        id: "exp-1",
        company: "Example Logistics Pte Ltd",
        title: "Senior Operations Analyst",
        location: "Singapore",
        start: "2021-03",
        end: "",
        bullets: [
          "Built weekly dashboards that cut report preparation time by half.",
          "Led a three-person team reviewing warehouse picking routes.",
          "Trained 20 new staff on the inventory system.",
        ],
      },
      {
        id: "exp-2",
        company: "Sample Freight Services Pte Ltd",
        title: "Operations Executive",
        location: "Singapore",
        start: "2018-06",
        end: "2021-02",
        bullets: [
          "Coordinated daily shipments for 12 regional customers.",
          "Reduced delivery exceptions through a simple tracking checklist.",
        ],
      },
    ],
    education: [
      {
        id: "edu-1",
        school: "Example University",
        degree: "BSc Supply Chain Management",
        start: "2014",
        end: "2018",
        details: ["Second-class upper honours", "Dean's list, two semesters"],
      },
    ],
    certificates: ["Certified Supply Chain Analyst (example)"],
    skills: [
      { id: "skill-1", name: "Analysis", items: ["Excel", "SQL", "Process mapping"] },
      { id: "skill-2", name: "Software", items: ["Power BI", "Jira"] },
    ],
    languages: ["English (fluent)", "Mandarin (fluent)"],
    projects: [],
    extras: [],
    order: [...DEFAULT_ORDER],
  };
}
