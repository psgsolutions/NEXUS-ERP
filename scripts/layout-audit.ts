import { chromium, Browser, Page } from "playwright";
import * as fs from "fs";
import * as path from "path";

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
}

export const VIEWPORTS: ViewportConfig[] = [
  { name: "1280x720", width: 1280, height: 720 },
  { name: "1366x768", width: 1366, height: 768 },
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1536x864", width: 1536, height: 864 },
  { name: "1680x1050", width: 1680, height: 1050 },
  { name: "1920x1080", width: 1920, height: 1080 },
  { name: "2560x1440", width: 2560, height: 1440 },
  { name: "3840x2160", width: 3840, height: 2160 }
];

export interface PageTarget {
  name: string;
  labelThai: string;
  path: string;
}

export const PAGES: PageTarget[] = [
  { name: "quotation_new", labelThai: "ใบเสนอราคาใหม่", path: "/sales/quotations/new" },
  { name: "product_new", labelThai: "เพิ่มสินค้าใหม่", path: "/inventory/products/new" },
  { name: "project_new", labelThai: "สร้างโครงการ", path: "/projects/new" },
  { name: "settings", labelThai: "ตั้งค่า", path: "/settings" },
  { name: "inventory_list", labelThai: "รายการคลังสินค้า", path: "/inventory" },
  { name: "dashboard", labelThai: "ภาพรวม", path: "/dashboard" }
];

export interface LayoutAuditMetrics {
  horizontalScroll: boolean; // (a)
  overflowingTextCount: number; // (b)
  ellipsisWithoutTooltipCount: number; // (c)
  fontSizeUnder12Count: number; // (d)
  overlappingSiblingsCount: number; // (e)
  inputWidthUnder200Count: number; // (f)
  singleLineInputOver720Count: number; // (g)
  mainContentRatio: number; // (h) %
  sidebarWidth: number; // (i) px
  rightPanelWidth: number; // (i) px
  nestedVerticalScrollCount: number; // (j)
  screenshotPath: string;
}

export interface AuditResultCell {
  pageName: string;
  pageLabel: string;
  viewport: string;
  width: number;
  height: number;
  metrics: LayoutAuditMetrics;
}

// In-browser measurement script executed as string to avoid esbuild helper injection
const EVAL_MEASUREMENT_SCRIPT = `
(() => {
  var docEl = document.documentElement;
  var winWidth = window.innerWidth;
  var winHeight = window.innerHeight;

  // (a) Horizontal scrolling
  var horizontalScroll = docEl.scrollWidth > winWidth + 1;

  var isVisible = (el) => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
    var style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
    var rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  };

  var allElements = Array.from(document.querySelectorAll("*")).filter(isVisible);

  // (b) Overflowing text
  var overflowingTextCount = 0;
  // (c) Ellipsis without tooltip
  var ellipsisWithoutTooltipCount = 0;
  // (d) Font size < 12px
  var fontSizeUnder12Count = 0;
  // (f) Input/select width < 200px
  var inputWidthUnder200Count = 0;
  // (g) Single-line input width > 720px
  var singleLineInputOver720Count = 0;

  for (var i = 0; i < allElements.length; i++) {
    var el = allElements[i];
    var tagName = el.tagName.toLowerCase();
    var style = window.getComputedStyle(el);

    if (["svg", "path", "g", "polygon", "circle", "rect", "line", "script", "style"].includes(tagName)) {
      continue;
    }

    var hasDirectText = Array.from(el.childNodes).some(
      n => n.nodeType === Node.TEXT_NODE && (n.textContent || "").trim().length > 0
    );

    // (d) Font size < 12px
    if (hasDirectText || ["input", "select", "textarea", "button", "p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "label", "td", "th"].includes(tagName)) {
      var fontSizePx = parseFloat(style.fontSize);
      if (fontSizePx > 0 && fontSizePx < 11.95 && !el.closest("[data-ignore-font]")) {
        fontSizeUnder12Count++;
      }
    }

    // (b) & (c) Text overflow and ellipsis
    var isScrollableX = style.overflowX === "auto" || style.overflowX === "scroll";
    var isScrollableY = style.overflowY === "auto" || style.overflowY === "scroll";
    var isNoWrap = style.whiteSpace === "nowrap";

    if (style.textOverflow === "ellipsis") {
      var isTruncated = el.scrollWidth > el.clientWidth + 1;
      var hasTooltip = el.hasAttribute("title") || el.hasAttribute("data-tooltip") || el.hasAttribute("aria-label") || !!el.closest("[data-has-tooltip]");
      if (isTruncated && !hasTooltip) {
        ellipsisWithoutTooltipCount++;
      }
    } else if (!isScrollableX && !isScrollableY && isNoWrap && hasDirectText) {
      if (el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        overflowingTextCount++;
      }
    }

    // (f) & (g) Input controls
    if (["input", "select"].includes(tagName) || el.getAttribute("role") === "combobox") {
      var inputType = el.type || "text";
      var isExcluded = ["checkbox", "radio", "color", "range", "hidden", "file"].includes(inputType);
      if (!isExcluded) {
        var rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.width < 199.5) {
          inputWidthUnder200Count++;
        }
        if (tagName === "input" && inputType !== "range" && rect.width > 720.5) {
          singleLineInputOver720Count++;
        }
      }
    }
  }

  // (e) Overlapping sibling boxes
  var overlappingSiblingsCount = 0;
  var containers = Array.from(document.querySelectorAll("main, form, .grid, .flex, section, [data-card]"));
  for (var cIdx = 0; cIdx < containers.length; cIdx++) {
    var container = containers[cIdx];
    var children = Array.from(container.children).filter(isVisible);
    for (var a = 0; a < children.length; a++) {
      for (var b = a + 1; b < children.length; b++) {
        var elA = children[a];
        var elB = children[b];
        var styleA = window.getComputedStyle(elA);
        var styleB = window.getComputedStyle(elB);

        if (styleA.position === "absolute" || styleA.position === "fixed" || styleB.position === "absolute" || styleB.position === "fixed") continue;
        if (elA.hasAttribute("data-overlay") || elB.hasAttribute("data-overlay")) continue;
        if (elA.closest("[role='dialog']") || elB.closest("[role='dialog']")) continue;

        var rA = elA.getBoundingClientRect();
        var rB = elB.getBoundingClientRect();

        var overlapX = Math.max(0, Math.min(rA.right, rB.right) - Math.max(rA.left, rB.left));
        var overlapY = Math.max(0, Math.min(rA.bottom, rB.bottom) - Math.max(rA.top, rB.top));

        if (overlapX > 2 && overlapY > 2) {
          overlappingSiblingsCount++;
        }
      }
    }
  }

  // (h) Main content area width proportion to viewport (%)
  // (i) Sidebar and right panel width (px)
  var allAsides = Array.from(document.querySelectorAll("aside"));
  var sidebarEl = allAsides.length > 0 ? allAsides[0] : null;
  var sidebarWidth = (sidebarEl && isVisible(sidebarEl)) ? Math.round(sidebarEl.getBoundingClientRect().width) : 0;

  var rightPanelEl = allAsides.length > 1 ? allAsides[1] : document.querySelector("main + aside");
  var rightPanelWidth = (rightPanelEl && isVisible(rightPanelEl)) ? Math.round(rightPanelEl.getBoundingClientRect().width) : 0;

  var mainEl = document.querySelector("main");
  var mainWidth = (mainEl && isVisible(mainEl)) ? mainEl.getBoundingClientRect().width : (winWidth - sidebarWidth - rightPanelWidth);
  var mainContentRatio = Number(((mainWidth / winWidth) * 100).toFixed(1));

  // (j) Nested vertical scroll containers
  var nestedVerticalScrollCount = 0;
  for (var sIdx = 0; sIdx < allElements.length; sIdx++) {
    var sEl = allElements[sIdx];
    var sStyle = window.getComputedStyle(sEl);
    if (sStyle.overflowY === "auto" || sStyle.overflowY === "scroll") {
      var parent = sEl.parentElement;
      while (parent && parent !== document.body && parent !== document.documentElement) {
        var parentStyle = window.getComputedStyle(parent);
        if (parentStyle.overflowY === "auto" || parentStyle.overflowY === "scroll") {
          nestedVerticalScrollCount++;
          break;
        }
        parent = parent.parentElement;
      }
    }
  }

  return {
    horizontalScroll: horizontalScroll,
    overflowingTextCount: overflowingTextCount,
    ellipsisWithoutTooltipCount: ellipsisWithoutTooltipCount,
    fontSizeUnder12Count: fontSizeUnder12Count,
    overlappingSiblingsCount: overlappingSiblingsCount,
    inputWidthUnder200Count: inputWidthUnder200Count,
    singleLineInputOver720Count: singleLineInputOver720Count,
    mainContentRatio: mainContentRatio,
    sidebarWidth: sidebarWidth,
    rightPanelWidth: rightPanelWidth,
    nestedVerticalScrollCount: nestedVerticalScrollCount
  };
})()
`;

async function measurePageLayout(page: Page, screenshotPath: string): Promise<LayoutAuditMetrics> {
  const metrics: any = await page.evaluate(EVAL_MEASUREMENT_SCRIPT);
  return {
    ...metrics,
    screenshotPath
  };
}

// Fault injection proof test
export async function runFaultInjectionProof(browser: Browser): Promise<boolean> {
  console.log("\n🧪 Running Fault Injection Proof (3 simulated faults)...");
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  // Inject 3 deliberate layout faults in a standalone HTML page
  const faultHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { margin: 0; padding: 20px; font-family: sans-serif; background: #111; color: white; }
          .wide-box { width: 2000px; height: 50px; background: red; } /* Fault 1: Box wider than viewport */
          .overflow-text { width: 80px; white-space: nowrap; overflow: hidden; border: 1px solid yellow; } /* Fault 2: Text overflow without wrap */
          .tiny-font { font-size: 10px; } /* Fault 3: Font size 10px (< 12px) */
        </style>
      </head>
      <body>
        <div class="wide-box">Wide Box 2000px</div>
        <div class="overflow-text">This is a very long text string that overflows its container</div>
        <p class="tiny-font">This is tiny 10px font text</p>
      </body>
    </html>
  `;

  await page.setContent(faultHtml);
  const metrics = await measurePageLayout(page, "");
  await context.close();

  const detectedHorizontalScroll = metrics.horizontalScroll === true; // Fault 1
  const detectedOverflowText = metrics.overflowingTextCount > 0; // Fault 2
  const detectedTinyFont = metrics.fontSizeUnder12Count > 0; // Fault 3

  console.log(`  - Fault 1 (Box wider than viewport / horizontal scroll): ${detectedHorizontalScroll ? "✅ DETECTED" : "❌ MISSED"}`);
  console.log(`  - Fault 2 (Overflowing text without wrap): ${detectedOverflowText ? "✅ DETECTED" : "❌ MISSED"}`);
  console.log(`  - Fault 3 (Font size 10px < 12px): ${detectedTinyFont ? "✅ DETECTED" : "❌ MISSED"}`);

  const allDetected = detectedHorizontalScroll && detectedOverflowText && detectedTinyFont;
  console.log(`Fault injection detection result: ${allDetected ? "3/3 DETECTED (PASS)" : "FAIL"}\n`);
  return allDetected;
}

export async function runLayoutAudit() {
  console.log("================================================================================");
  console.log("🚀 NEXUS-ERP R0: COMPREHENSIVE RESPONSIVE LAYOUT AUDIT & BASELINE GENERATION");
  console.log("================================================================================\n");

  const artifactsDir = path.resolve(process.cwd(), "artifacts/layout");
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  // 1. Run Fault Injection Proof
  const faultProofPassed = await runFaultInjectionProof(browser);
  if (!faultProofPassed) {
    await browser.close();
    throw new Error("Fault injection proof failed. Audit script is unable to catch layout violations.");
  }

  // 2. Connect to local server
  const baseUrl = "http://localhost:3000";
  console.log(`Connecting to application at ${baseUrl}...`);

  const results: AuditResultCell[] = [];

  for (const pageTarget of PAGES) {
    console.log(`\n📄 Auditing Page: [${pageTarget.labelThai}] (${pageTarget.path})`);
    
    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height }
      });

      // Inject mock authenticated user into localStorage
      await context.addInitScript(() => {
        localStorage.setItem("selectedCompanyId", "COM-NEXUS-01");
        localStorage.setItem("nexus_mock_auth_user", JSON.stringify({
          uid: "test-admin-uid",
          email: "sadmin@admin.com",
          displayName: "System Superadmin",
          role: "SUPERADMIN",
          companyId: "COM-NEXUS-01"
        }));
      });

      const page = await context.newPage();
      const targetUrl = `${baseUrl}${pageTarget.path}`;
      
      try {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        await page.waitForSelector("main, form, h1, h2", { timeout: 10000 }).catch(() => {});
      } catch (e) {
        await page.waitForTimeout(1000);
      }

      await page.waitForTimeout(800); // Allow layout & rendering to stabilize

      const screenshotFilename = `${pageTarget.name}_${vp.width}x${vp.height}.png`;
      const screenshotFilePath = path.join(artifactsDir, screenshotFilename);
      await page.screenshot({ path: screenshotFilePath, fullPage: false });

      const metrics = await measurePageLayout(page, screenshotFilePath);

      results.push({
        pageName: pageTarget.name,
        pageLabel: pageTarget.labelThai,
        viewport: vp.name,
        width: vp.width,
        height: vp.height,
        metrics
      });

      await context.close();
    }
  }

  await browser.close();

  // Save Baseline JSON
  const baselineJsonPath = path.join(artifactsDir, "baseline.json");
  fs.writeFileSync(baselineJsonPath, JSON.stringify(results, null, 2), "utf8");
  console.log(`\n💾 Saved baseline results to: ${baselineJsonPath}`);

  // Print Full Baseline Table Matrix
  console.log("\n=================================================================================================================================");
  console.log("📊 R0 BASELINE MEASUREMENT MATRIX (6 Pages × 8 Viewports = 48 Cells)");
  console.log("=================================================================================================================================");
  console.log(
    "Page".padEnd(20) +
    "Viewport".padEnd(12) +
    "(a)H-Scroll".padEnd(12) +
    "(b)TxtOver".padEnd(12) +
    "(c)EllipNoTip".padEnd(14) +
    "(d)Font<12".padEnd(12) +
    "(e)Overlap".padEnd(12) +
    "(f)In<200".padEnd(10) +
    "(g)In>720".padEnd(10) +
    "(h)Main%".padEnd(10) +
    "(i)Side/R-W".padEnd(16) +
    "(j)NestScr"
  );
  console.log("-".repeat(138));

  for (const r of results) {
    const m = r.metrics;
    console.log(
      r.pageLabel.padEnd(20) +
      r.viewport.padEnd(12) +
      (m.horizontalScroll ? "YES (FAIL)" : "No (0)").padEnd(12) +
      String(m.overflowingTextCount).padEnd(12) +
      String(m.ellipsisWithoutTooltipCount).padEnd(14) +
      String(m.fontSizeUnder12Count).padEnd(12) +
      String(m.overlappingSiblingsCount).padEnd(12) +
      String(m.inputWidthUnder200Count).padEnd(10) +
      String(m.singleLineInputOver720Count).padEnd(10) +
      (m.mainContentRatio + "%").padEnd(10) +
      (`${m.sidebarWidth} / ${m.rightPanelWidth}px`).padEnd(16) +
      String(m.nestedVerticalScrollCount)
    );
  }
  console.log("=================================================================================================================================\n");

  return results;
}

if (require.main === module) {
  runLayoutAudit().catch(err => {
    console.error("❌ Layout audit encountered an error:", err);
    process.exit(1);
  });
}
