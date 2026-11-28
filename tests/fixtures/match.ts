// Fixtures for resume-sg#48 (match analysis). Synthetic people, companies and texts only.
//
// Shape assumed for the parts the issue leaves open (the builder follows it; see tests/unit/match-analysis.test.ts):
//   MatchOutput = {
//     requirements: { jdQuote, status: "evidence" | "partial" | "missing", evidenceQuote?, note }[],
//     strengths: { jdQuote, status: "evidence", evidenceQuote, note, howToTell }[],   // 3 to 5
//     gaps: { jdQuote, howToAddress }[],
//     interviewQuestions: { question, starPoints: string[] }[],                        // exactly 5
//     questionsToAsk: string[],                                                         // exactly 2
//   }
import type { MatchOutput } from "../../src/ai/types.ts";
import { sseText } from "./sse.ts";
import { ORIGINAL_EN } from "./tailor-flow.ts";

export { ORIGINAL_EN };

/** A JD with one requirement the resume lacks (Rust) and one it only partly meets (a team of 10 or more). */
export const JD_MATCH = [
  "Acme Pay · Senior Backend Engineer (Payments Platform)",
  "Requirements:",
  "- 6+ years of Java/Kotlin backend work",
  "- Hands-on Kafka event streaming",
  "- Idempotent API design",
  "- Experience leading a team of 10 or more engineers",
  "- Production Rust systems programming",
  "Nice to have: Spanish for regional partners",
].join("\n");

export const Q = {
  years: "6+ years of Java/Kotlin backend work",
  kafka: "Hands-on Kafka event streaming",
  idem: "Idempotent API design",
  lead: "Experience leading a team of 10 or more engineers",
  rust: "Production Rust systems programming",
} as const;
export const E = {
  years: "Backend engineer with 9 years of experience in fintech",
  kafka: "Moved 14 services from a monolith to Kafka events with zero downtime.",
  idem: "Built a payment API with idempotency keys; it handles 1,200 transactions per second at peak.",
  lead: "Mentored 5 engineers; two were promoted to senior.",
  inventedRust: "Wrote production Rust services for the settlement engine.",
} as const;

export const RUST_ADVICE =
  "Say plainly that you have not used Rust at work; name a small side project you could start and explain how your Kafka and Java experience transfers.";

export function validMatch(): MatchOutput {
  return {
    requirements: [
      { jdQuote: Q.years, status: "evidence", evidenceQuote: E.years, note: "Nine years in fintech backend work." },
      { jdQuote: Q.kafka, status: "evidence", evidenceQuote: E.kafka, note: "Kafka migration of 14 services." },
      { jdQuote: Q.idem, status: "evidence", evidenceQuote: E.idem, note: "Payment API with idempotency keys." },
      { jdQuote: Q.lead, status: "partial", evidenceQuote: E.lead, note: "Mentoring 5 engineers, not a team of 10." },
      { jdQuote: Q.rust, status: "missing", note: "No Rust anywhere in the resume." },
    ],
    strengths: [
      { jdQuote: Q.years, status: "evidence", evidenceQuote: E.years, note: "Long fintech record.", howToTell: "Open with the nine years and the settlement redesign." },
      { jdQuote: Q.kafka, status: "evidence", evidenceQuote: E.kafka, note: "Zero-downtime migration.", howToTell: "Tell the migration as a story: risk, plan, result." },
      { jdQuote: Q.idem, status: "evidence", evidenceQuote: E.idem, note: "Idempotent payment API.", howToTell: "Explain why idempotency keys matter for retries." },
    ],
    gaps: [
      { jdQuote: Q.rust, howToAddress: RUST_ADVICE },
      { jdQuote: Q.lead, howToAddress: "Be honest that you mentored 5 engineers; describe how you would grow into a larger team." },
    ],
    interviewQuestions: [1, 2, 3, 4, 5].map((n) => ({
      question: `Interview question number ${n}: tell us about a system you made reliable.`,
      starPoints: [`Situation ${n}: the settlement batch ran for 4 hours.`, `Action ${n}: redesigned the settlement service.`, `Result ${n}: batch time fell to 35 minutes.`],
    })),
    questionsToAsk: ["How does the payments team decide what to build next?", "What does on-call look like for this platform?"],
  };
}

/** The same analysis, plus a strength that wrongly claims Rust: its evidence quote is not in the resume. */
export function matchWithInventedStrength(): MatchOutput {
  const o = validMatch();
  o.strengths.push({ jdQuote: Q.rust, status: "evidence", evidenceQuote: E.inventedRust, note: "Rust experience.", howToTell: "Describe the Rust settlement engine." });
  return o;
}

/** One requirement with an invented evidence quote, nothing else wrong. */
export function matchWithInventedRequirement(): MatchOutput {
  const o = validMatch();
  o.requirements[1] = { jdQuote: Q.kafka, status: "evidence", evidenceQuote: "Led the Kafka platform team of 40 engineers at a unicorn.", note: "Invented." };
  return o;
}

export const XSS = ['<script>alert("x1")</script>', '<img src=x onerror="alert(2)">'] as const;

/** Model text with markup in every free-text field (not in the quotes, which code checks). */
export function matchWithMarkup(): MatchOutput {
  const o = validMatch();
  const [s, i] = XSS;
  o.requirements[0] = { ...(o.requirements[0] as MatchOutput["requirements"][number]), note: `note ${s}` };
  o.strengths[0] = { ...(o.strengths[0] as MatchOutput["strengths"][number]), howToTell: `tell ${i}` };
  o.gaps[0] = { jdQuote: Q.rust, howToAddress: `address ${s}${i}` };
  o.interviewQuestions[0] = { question: `question ${i}`, starPoints: [`star ${s}`, `star ${i}`] };
  o.questionsToAsk[0] = `ask ${s}`;
  return o;
}

export const matchResponse = (o: MatchOutput): Response => sseText(JSON.stringify(o));
export const matchBody = (o: MatchOutput): string => JSON.stringify(o);
