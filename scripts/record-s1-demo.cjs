const path = require("node:path");
const { chromium } = require("/tmp/streampump-recording/node_modules/playwright");

const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "demo-recordings", "playwright-s1-demo");

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function clickFirst(page, role, name) {
  const locator = page.getByRole(role, { name }).first();
  await locator.scrollIntoViewIfNeeded();
  await locator.click();
}

async function main() {
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
  });
  const context = await browser.newContext({
    locale: "zh-CN",
    recordVideo: {
      dir: outputDir,
      size: { width: 1440, height: 900 },
    },
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/demo", { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.getByRole("heading", { name: "Three demo tracks" }).waitFor();
  await pause(5000);

  await clickFirst(page, "link", "Open market");
  await page.getByText("Current price").first().waitFor();
  await pause(12000);

  await clickFirst(page, "button", "Buy S1");
  await page.getByText("Buy confirmation").waitFor();
  await pause(2500);
  await clickFirst(page, "button", "Confirm Buy S1");
  await page.getByText("Bought").first().waitFor();
  await pause(8000);

  await clickFirst(page, "button", "Sell");
  await pause(2000);
  await clickFirst(page, "button", "5");
  await pause(2000);
  await clickFirst(page, "button", "Sell S1");
  await page.getByText("Sell confirmation").waitFor();
  await pause(2500);
  await clickFirst(page, "button", "Confirm Sell S1");
  await page.getByText("Sold").first().waitFor();
  await pause(8000);

  await clickFirst(page, "link", "Buyout watch");
  await page.getByText("S1 Buyout Room").waitFor();
  await pause(14000);

  await clickFirst(page, "button", "Exit Position");
  await page.getByText("Rage quit confirmation").waitFor();
  await pause(2500);
  await clickFirst(page, "button", "Confirm Exit Position");
  await page.getByText("Exited").first().waitFor();
  await pause(9000);

  await clickFirst(page, "button", "Claim");
  await page.getByText("Claim confirmation").waitFor();
  await pause(2500);
  await clickFirst(page, "button", "Confirm Claim");
  await page.getByText("Claimed").first().waitFor();
  await pause(9000);

  await clickFirst(page, "link", "Portfolio");
  await page.getByText("Claim queue").first().waitFor();
  await pause(22000);

  await context.close();
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
