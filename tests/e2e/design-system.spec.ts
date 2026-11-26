import { expect, test, type Locator, type Page } from "@playwright/test";

// #19 design-spec v1: e2e checks for criteria 2, 5, 6, 7, 8, 9, 10 and 11.
// Colours and sizes come from the issue. Class names are free, except the ones criterion 9 names
// (.input, .btn-primary, .btn-ghost) plus the size classes .btn-sm (32 px) and .btn-lg (50 px) of the reference CSS.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const ACCENT = "rgb(10, 92, 216)";
const ALT = "rgb(245, 245, 247)";
const LANGS = ["en", "zh"] as const;
const LOCALE = { en: "en-US", zh: "zh-CN" } as const;

const NAV = {
  en: { how: "How it works", faq: "FAQ", contact: "Contact", start: "Start", menu: "Menu", langText: "中文" },
  zh: { how: "工作原理", faq: "常见问题", contact: "联系我们", start: "开始定制", menu: "菜单", langText: "EN" },
};
const HOME = {
  en: { h1: "Your resume, aimed at this job.", reasons: "Three reasons you can trust it", steps: "Three steps", free: "Free", step1: "Add your resume", tag: "Job description", cvTag: "Tailored resume", how: "How it works ›" },
  zh: { h1: "简历，对准这个岗位。", reasons: "放心用，是因为这三点", steps: "三步完成", free: "完全免费", step1: "放入原简历", tag: "职位描述", cvTag: "定制后的简历", how: "了解工作原理 ›" },
};
const ROUTES = ["#/", "#/app", "#/how-it-works", "#/faq", "#/contact", "#/privacy"];
const INFO = [
  { hash: "#/how-it-works", name: "how-it-works" },
  { hash: "#/faq", name: "faq" },
  { hash: "#/contact", name: "contact" },
  { hash: "#/privacy", name: "privacy" },
];

const header = (page: Page) => page.getByRole("banner").first();
const px = (v: string) => parseFloat(v);
async function bb(l: Locator) {
  const b = await l.first().boundingBox();
  if (!b) throw new Error("element has no box (not visible)");
  return b;
}

/** Computed style of the first element and, optionally, of its ancestors. */
async function ancestorStyles(loc: Locator, props: string[]): Promise<Record<string, string>[]> {
  return loc.first().evaluate((el, ps) => {
    const out: Record<string, string>[] = [];
    for (let n: Element | null = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const o: Record<string, string> = { tag: n.tagName.toLowerCase() };
      for (const p of ps) o[p] = (cs as unknown as Record<string, string>)[p] ?? "";
      out.push(o);
    }
    return out;
  }, props);
}

for (const lang of LANGS) {
  const n = NAV[lang];
  test.describe(`navigation, ${lang}`, () => {
    test.use({ locale: LOCALE[lang] });

    test("desktop 1440: sticky 56 px bar, accent 2, links, pills, no menu button", async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto("/#/");
      const h = header(page);
      await expect(h.getByRole("link", { name: n.how })).toBeVisible();
      await expect(h.getByRole("link", { name: n.faq })).toBeVisible();
      await expect(h.getByRole("link", { name: n.contact })).toBeVisible();
      await expect(h.getByRole("link", { name: n.start, exact: true })).toBeVisible();
      await expect(h.locator("button", { hasText: n.langText })).toBeVisible();
      await expect(h.getByRole("button", { name: n.menu })).toBeHidden();
      if (lang === "zh") await expect(page.getByText("对岗简历")).toBeVisible();
      else await expect(page.getByText("对岗简历")).toHaveCount(0);

      // wordmark: JD2CV with the "2" in the accent colour
      await expect(h.getByRole("link", { name: /^JD2CV/ })).toBeVisible();
      const two = await h.evaluate((root) => {
        const el = Array.from(root.querySelectorAll("*")).find((e) => e.children.length === 0 && e.textContent === "2");
        return el ? { color: getComputedStyle(el).color, parent: el.parentElement?.textContent?.trim().startsWith("JD2CV") ?? false } : null;
      });
      expect(two, "an element holding just the 2 of the wordmark").not.toBeNull();
      expect(two?.color).toBe(ACCENT);
      expect(two?.parent).toBe(true);

      // sticky: stays at the top after scrolling, 56 px high, translucent white with blur and a hairline
      await page.evaluate(() => window.scrollTo(0, 600));
      const box = await h.boundingBox();
      expect(box?.y).toBeCloseTo(0, 0);
      expect(box?.height).toBeGreaterThanOrEqual(56);
      expect(box?.height).toBeLessThanOrEqual(57); // 56 plus the 1 px hairline when it sits outside the height
      const sticky = await h.evaluate((root) => {
        const chain: Element[] = [];
        for (let e: Element | null = root; e && e !== document.body; e = e.parentElement) chain.push(e);
        const el = chain.find((e) => getComputedStyle(e).position === "sticky");
        if (!el) return null;
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, filter: cs.backdropFilter || cs.getPropertyValue("-webkit-backdrop-filter"), border: cs.borderBottomWidth, top: cs.top };
      });
      expect(sticky, "header or an ancestor has position: sticky").not.toBeNull();
      expect(sticky?.top).toBe("0px");
      expect(sticky?.bg).toBe("rgba(255, 255, 255, 0.82)");
      expect(sticky?.filter).toMatch(/saturate\((1\.8|180%)\)/);
      expect(sticky?.filter).toMatch(/blur\(20px\)/);
      expect(sticky?.border).toBe("1px");
    });

    test("phone 390: sub-label hidden, text links in a menu sheet that closes on Escape and link click", async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto("/#/");
      const h = header(page);
      await expect(page.getByText("对岗简历")).toBeHidden();
      await expect(h.getByRole("link", { name: n.start, exact: true })).toBeVisible();
      await expect(h.locator("button", { hasText: n.langText })).toBeVisible();
      for (const t of [n.how, n.faq, n.contact]) await expect(h.getByRole("link", { name: t })).toBeHidden();
      const menu = h.getByRole("button", { name: n.menu });
      await expect(menu).toBeVisible();
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      const two = await h.evaluate((root) => {
        const el = Array.from(root.querySelectorAll("*")).find((e) => e.children.length === 0 && e.textContent === "2");
        return el ? getComputedStyle(el).color : null;
      });
      expect(two).toBe(ACCENT);

      // open by click: a full-width sheet with the three links
      await menu.click();
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      const links = [n.how, n.faq, n.contact].map((t) => page.getByRole("link", { name: t, exact: true }).first());
      for (const l of links) await expect(l).toBeVisible();
      const sheetWidth = await (links[1] as Locator).evaluate((faq) => {
        // climb from the FAQ link while the parent still holds only menu links (no brand, no Start pill, no buttons)
        let node: HTMLElement = faq as HTMLElement;
        while (node.parentElement && node.parentElement !== document.body) {
          const p = node.parentElement;
          if (p.querySelector("button") || p.querySelector('a[href="#/app"]') || p.querySelector('a[href="#/"]')) break;
          node = p;
        }
        return node.getBoundingClientRect().width;
      });
      expect(sheetWidth).toBeGreaterThanOrEqual(389);

      // Escape closes
      await page.keyboard.press("Escape");
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("link", { name: n.faq, exact: true }).first()).toBeHidden();

      // keyboard opens (Enter on the focused button), a link click closes and navigates
      await menu.focus();
      await page.keyboard.press("Enter");
      await expect(menu).toHaveAttribute("aria-expanded", "true");
      await page.getByRole("link", { name: n.faq, exact: true }).first().click();
      await expect(page).toHaveURL(/#\/faq$/);
      await expect(menu).toHaveAttribute("aria-expanded", "false");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    });
  });
}

for (const lang of LANGS) {
  const h = HOME[lang];
  test.describe(`home layout, ${lang}`, () => {
    test.use({ locale: LOCALE[lang] });

    test("desktop 1440: h1 68 px, h2 44 px, rhythm, cards, buttons side by side, visual in a row", async ({ page }) => {
      await page.setViewportSize(DESKTOP);
      await page.goto("/#/");
      const h1 = page.getByRole("heading", { level: 1 });
      const cs = await h1.evaluate((e) => {
        const s = getComputedStyle(e);
        return { size: s.fontSize, weight: s.fontWeight, ls: s.letterSpacing };
      });
      expect(cs.size).toBe("68px");
      expect(cs.weight).toBe("700");
      expect(px(cs.ls)).toBeCloseTo(-1.7, 1);

      const h2 = page.getByRole("heading", { level: 2, name: h.steps });
      expect(await h2.evaluate((e) => getComputedStyle(e).fontSize)).toBe("44px");
      const chain = await ancestorStyles(h2, ["paddingTop", "paddingLeft", "maxWidth"]);
      expect(chain.some((c) => c.paddingTop === "88px"), "an ancestor section has 88 px vertical padding").toBe(true);
      expect(chain.some((c) => c.maxWidth === "1080px" && c.paddingLeft === "24px"), "content wrapper 1080 px with 24 px side padding").toBe(true);
      // alternate background: the reasons section
      const alt = await ancestorStyles(page.getByRole("heading", { level: 2, name: h.reasons }), ["backgroundColor"]);
      expect(alt.some((c) => c.backgroundColor === ALT)).toBe(true);

      // cards: 22 px radius and the card shadow on reason cards; step cards have a hairline border and no shadow
      const card = await ancestorStyles(page.getByRole("heading", { level: 3, name: h.free }), ["borderRadius", "boxShadow"]);
      expect(card.some((c) => c.borderRadius === "22px" && /0px 8px 28px/.test(c.boxShadow ?? "") && /0px 1px 2px/.test(c.boxShadow ?? ""))).toBe(true);
      const step = await ancestorStyles(page.getByRole("heading", { level: 3, name: h.step1 }), ["borderRadius", "borderTopWidth", "borderTopColor", "boxShadow"]);
      expect(step.some((c) => c.borderRadius === "22px" && c.borderTopWidth === "1px" && c.boxShadow === "none")).toBe(true);

      // three columns of reason cards and of step cards
      const xs3 = await page.getByRole("main").getByRole("heading", { level: 3 }).evaluateAll((els) =>
        els.map((e) => Math.round(e.getBoundingClientRect().x)),
      );
      expect(new Set(xs3.slice(0, 3)).size).toBe(3);
      expect(new Set(xs3.slice(3)).size).toBe(3);
      // buttons side by side
      const main = page.getByRole("main");
      const primary = main.getByRole("link", { name: NAV[lang].start, exact: true }).first();
      const ghost = main.getByRole("link", { name: h.how, exact: true });
      const pb = await primary.boundingBox();
      const gb = await ghost.boundingBox();
      expect(Math.abs((pb?.y ?? 0) - (gb?.y ?? 99))).toBeLessThan(4);
      expect(pb?.height).toBeCloseTo(50, 0);
      // visual: JD card left of the arrow left of the resume card
      const jd = await bb(page.getByText(h.tag, { exact: true }));
      const cv = await bb(page.getByText(h.cvTag, { exact: true }));
      const arrow = await bb(page.getByText(/AI\s*→/));
      expect(jd.x).toBeLessThan(arrow.x);
      expect(arrow.x).toBeLessThan(cv.x);
    });

    test("phone 390: h1 40 px, h2 30 px, buttons full width and stacked, visual stacked with a rotated arrow, one column grids", async ({ page }) => {
      await page.setViewportSize(PHONE);
      await page.goto("/#/");
      expect(await page.getByRole("heading", { level: 1 }).evaluate((e) => getComputedStyle(e).fontSize)).toBe("40px");
      const h2 = page.getByRole("heading", { level: 2, name: h.steps });
      expect(await h2.evaluate((e) => getComputedStyle(e).fontSize)).toBe("30px");
      const chain = await ancestorStyles(h2, ["paddingTop"]);
      expect(chain.some((c) => c.paddingTop === "56px")).toBe(true);

      const main = page.getByRole("main");
      const primary = main.getByRole("link", { name: NAV[lang].start, exact: true }).first();
      const ghost = main.getByRole("link", { name: h.how, exact: true });
      const pb = await bb(primary);
      const gb = await bb(ghost);
      expect(pb.width).toBeGreaterThanOrEqual(340); // 390 - 2 x 24 = 342
      expect(gb.width).toBeGreaterThanOrEqual(340);
      expect(gb.y).toBeGreaterThanOrEqual(pb.y + pb.height - 1);

      // visual stacks vertically: JD card, arrow, resume card
      const jd = await bb(page.getByText(h.tag, { exact: true }));
      const cv = await bb(page.getByText(h.cvTag, { exact: true }));
      const arrowEl = page.getByText(/AI\s*→/).first();
      const arrow = await bb(arrowEl);
      expect(jd.y).toBeLessThan(arrow.y);
      expect(arrow.y).toBeLessThan(cv.y);
      expect(Math.abs(jd.x - cv.x)).toBeLessThan(2);
      // the arrow (or its wrapper) is rotated 90 degrees: matrix(0, 1, -1, 0, ...)
      const rotated = await arrowEl.evaluate((el) =>
        [el, el.parentElement].some((e) => {
          const t = e ? getComputedStyle(e).transform : "none";
          const m = /^matrix\(([^)]+)\)$/.exec(t);
          if (!m) return false;
          const [a, b] = (m[1] as string).split(",").map(Number);
          return Math.abs(a ?? 1) < 0.01 && Math.abs(Math.abs(b ?? 0) - 1) < 0.01;
        }),
      );
      expect(rotated, "arrow rotated 90 degrees on phone").toBe(true);

      // grids: one column
      const allH3 = await main.getByRole("heading", { level: 3 }).evaluateAll((els) =>
        els.map((e) => ({ x: Math.round(e.getBoundingClientRect().x), y: e.getBoundingClientRect().y })),
      );
      expect(allH3.length).toBe(6);
      expect(new Set(allH3.map((e) => e.x)).size).toBe(1);
      const ys = allH3.map((e) => e.y);
      expect([...ys].sort((a, b) => a - b)).toEqual(ys);
    });
  });
}

test.describe("arrow is not rotated on desktop", () => {
  test("1440", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/#/");
    const rotated = await page.getByText(/AI\s*→/).first().evaluate((el) =>
      [el, el.parentElement].some((e) => {
        const t = e ? getComputedStyle(e).transform : "none";
        return t !== "none" && !/^matrix\(1, 0, 0, 1/.test(t);
      }),
    );
    expect(rotated).toBe(false);
  });
});

test.describe("info pages use the alternate header block with an h2-sized title", () => {
  for (const lang of LANGS) {
    test.describe(lang, () => {
      test.use({ locale: LOCALE[lang] });
      for (const p of INFO) {
        test(`${p.hash} at 1440 and 390`, async ({ page }) => {
          for (const [vp, size] of [[DESKTOP, "44px"], [PHONE, "30px"]] as const) {
            await page.setViewportSize(vp);
            await page.goto(`/${p.hash}`);
            await page.reload();
            const h1 = page.getByRole("heading", { level: 1 });
            await expect(h1).toHaveCount(1);
            expect(await h1.evaluate((e) => getComputedStyle(e).fontSize)).toBe(size);
            const chain = await ancestorStyles(h1, ["backgroundColor"]);
            expect(chain.some((c) => c.backgroundColor === ALT), "title sits in an alternate-background block").toBe(true);
            // cards follow the header block
            const cards = await page.getByRole("main").evaluate((m) =>
              Array.from(m.querySelectorAll("*")).filter((e) => getComputedStyle(e).borderRadius === "22px").length,
            );
            expect(cards).toBeGreaterThan(0);
          }
        });
      }
    });
  }
});

test.describe("no horizontal overflow at 360 px", () => {
  for (const lang of LANGS) {
    test.describe(lang, () => {
      test.use({ locale: LOCALE[lang] });
      for (const hash of ROUTES) {
        test(`${hash}`, async ({ page }) => {
          await page.setViewportSize({ width: 360, height: 740 });
          await page.goto(`/${hash}`);
          await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
          const m = await page.evaluate(() => ({
            html: document.documentElement.scrollWidth,
            body: document.body.scrollWidth,
            ox: [getComputedStyle(document.documentElement).overflowX, getComputedStyle(document.body).overflowX],
          }));
          expect(m.html).toBeLessThanOrEqual(360);
          expect(m.body).toBeLessThanOrEqual(360);
          for (const o of m.ox) expect(["hidden", "clip"]).not.toContain(o);
          // the open menu sheet must not overflow either
          const menu = header(page).getByRole("button", { name: NAV[lang].menu });
          await expect(menu).toBeVisible();
          await menu.click();
          expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
        });
      }
    });
  }
});

test.describe("motion", () => {
  test("only opacity and transform at 200 ms", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/#/");
    const bad = await page.evaluate(() => {
      const out: string[] = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const cs = getComputedStyle(el);
        const durs = cs.transitionDuration.split(",").map((x) => x.trim());
        const props = cs.transitionProperty.split(",").map((x) => x.trim());
        durs.forEach((d, i) => {
          if (d === "0s") return;
          const prop = props[i % props.length] ?? "";
          if (d !== "0.2s" || !["opacity", "transform"].includes(prop)) out.push(`${el.tagName}.${el.className}: ${prop} ${d}`);
        });
      }
      return out;
    });
    expect(bad).toEqual([]);
    const anyMotion = await page.evaluate(() =>
      Array.from(document.querySelectorAll("a, button")).some((e) => getComputedStyle(e).transitionDuration !== "0s"),
    );
    expect(anyMotion, "buttons and links animate (200 ms)").toBe(true);
  });

  test.describe("reduced", () => {
    test.use({ reducedMotion: "reduce" });
    for (const hash of ["#/", "#/how-it-works", "#/app"]) {
      test(`every transition is 0s on ${hash}`, async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto(`/${hash}`);
        const bad = await page.evaluate(() =>
          Array.from(document.querySelectorAll("*"))
            .filter((el) => {
              const cs = getComputedStyle(el);
              return [cs.transitionDuration, cs.animationDuration].some((v) => v.split(",").some((x) => x.trim() !== "0s"));
            })
            .map((e) => `${e.tagName}.${e.className}`),
        );
        expect(bad).toEqual([]);
        expect(await page.locator("a, button").count()).toBeGreaterThan(3);
      });
    }
  });
});

test.describe("input and button classes for later issues (criterion 9)", () => {
  test("on the App page: .input, .btn-primary, .btn-ghost, sizes 32 and 50 px", async ({ page }) => {
    await page.goto("/#/app");
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    await page.evaluate(() => {
      const box = document.createElement("div");
      box.id = "qa-samples";
      box.innerHTML = `
        <label for="qa-input" id="qa-label">Sample label</label>
        <input id="qa-input" class="input" type="text" />
        <a id="qa-primary-sm" class="btn btn-sm btn-primary" href="#/app">Primary small</a>
        <a id="qa-primary-lg" class="btn btn-lg btn-primary" href="#/app">Primary large</a>
        <a id="qa-ghost-sm" class="btn btn-sm btn-ghost" href="#/app">Ghost small</a>
        <button id="qa-ghost-lg" class="btn btn-lg btn-ghost" type="button">Ghost large</button>`;
      (document.querySelector("main") ?? document.body).appendChild(box);
    });
    const style = (id: string, props: string[]) =>
      page.locator(`#${id}`).evaluate((e, ps) => {
        const cs = getComputedStyle(e) as unknown as Record<string, string>;
        return Object.fromEntries(ps.map((p) => [p, cs[p] ?? ""]));
      }, props);

    const input = await style("qa-input", ["height", "borderRadius", "borderTopWidth", "borderTopColor", "boxShadow"]);
    expect(input.height).toBe("44px");
    expect(input.borderRadius).toBe("12px");
    expect(input.borderTopWidth).toBe("1px");
    expect(input.borderTopColor).toBe("rgb(210, 210, 215)");
    await page.locator("#qa-input").focus();
    const focused = await style("qa-input", ["boxShadow"]);
    expect(focused.boxShadow).toContain("rgba(10, 92, 216, 0.2)");
    expect(focused.boxShadow).toMatch(/0px 0px 0px 4px/);

    const ps = await style("qa-primary-sm", ["height", "backgroundColor", "color", "borderRadius"]);
    expect(ps.height).toBe("32px");
    expect(ps.backgroundColor).toBe(ACCENT);
    expect(ps.color).toBe("rgb(255, 255, 255)");
    expect(px(ps.borderRadius as string)).toBeGreaterThanOrEqual(16);
    expect((await style("qa-primary-lg", ["height"])).height).toBe("50px");
    const gs = await style("qa-ghost-sm", ["height", "color", "backgroundColor"]);
    expect(gs.height).toBe("32px");
    expect(gs.color).toBe(ACCENT);
    expect(["rgba(0, 0, 0, 0)", "transparent"]).toContain(gs.backgroundColor);
    expect((await style("qa-ghost-lg", ["height"])).height).toBe("50px");
    expect((await style("qa-label", ["fontSize", "fontWeight"])).fontSize).toBe("14px");
  });
});

test.describe("keyboard", () => {
  for (const vp of [DESKTOP, PHONE]) {
    test(`Tab reaches every visible link and button on Home at ${vp.width}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await page.goto("/#/");
      const total = await page.evaluate(() => {
        let i = 0;
        for (const el of Array.from(document.querySelectorAll("a[href], button"))) {
          const r = el.getBoundingClientRect();
          const cs = getComputedStyle(el);
          if (r.width > 0 && r.height > 0 && cs.visibility !== "hidden") el.setAttribute("data-qa-tab", String(i++));
        }
        return i;
      });
      expect(total).toBeGreaterThan(8);
      const seen = new Set<string>();
      for (let i = 0; i < total + 6; i++) {
        await page.keyboard.press("Tab");
        const id = await page.evaluate(() => document.activeElement?.getAttribute("data-qa-tab") ?? null);
        if (id !== null) seen.add(id);
      }
      expect(seen.size).toBe(total);
    });
  }
});

test.describe("screenshots of Home and the info pages (criterion 10)", () => {
  for (const lang of LANGS) {
    test.describe(lang, () => {
      test.use({ locale: LOCALE[lang] });
      test(`home desktop and mobile, ${lang}`, async ({ page }) => {
        await page.setViewportSize(DESKTOP);
        await page.goto("/#/");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(HOME[lang].h1);
        expect(await page.getByRole("heading", { level: 1 }).evaluate((e) => getComputedStyle(e).fontSize)).toBe("68px");
        await page.screenshot({ path: `test-results/design-home-desktop-${lang}.png`, fullPage: true });
        await page.setViewportSize(PHONE);
        await page.goto("/#/");
        await page.reload();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
        await page.screenshot({ path: `test-results/design-home-mobile-${lang}.png`, fullPage: true });
      });
      for (const p of INFO) {
        test(`${p.name} at 390, ${lang}`, async ({ page }) => {
          await page.setViewportSize(PHONE);
          await page.goto(`/${p.hash}`);
          const h1 = page.getByRole("heading", { level: 1 });
          expect(await h1.evaluate((e) => getComputedStyle(e).fontSize)).toBe("30px");
          await page.screenshot({ path: `test-results/design-${p.name}-mobile-${lang}.png`, fullPage: true });
        });
      }
    });
  }
});

test("no foreign requests and no console errors on Home", async ({ page, baseURL }) => {
  const urls: string[] = [];
  const errors: string[] = [];
  page.on("request", (q) => urls.push(q.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize(DESKTOP);
  await page.goto("/#/");
  const origin = new URL(baseURL ?? "http://127.0.0.1:4173").origin;
  for (const u of urls) if (!u.startsWith("data:") && !u.startsWith("blob:")) expect(u.startsWith(origin)).toBe(true);
  expect(urls.filter((u) => /\.(png|jpe?g|gif|webp|woff2?|ttf|otf)(\?|$)/i.test(u))).toEqual([]);
  expect(errors).toEqual([]);
});
