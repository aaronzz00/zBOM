import { chromium } from 'playwright-core';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3001/';
const chromePath = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const outputDir = 'docs/user-tests/20260605-core-modules-production-usecase-check/screenshots';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'narrow', width: 390, height: 844 },
];

const pages = [
  { nav: 'BOM Editor', proof: 'BOM Editor', filename: 'bom-editor' },
  { nav: 'Part Library', proof: 'Library Filters', filename: 'part-library' },
  { nav: 'Tooling Hub', proof: 'Tooling Records', filename: 'tooling-hub' },
  { nav: 'Dashboard', proof: 'Development Preview - not part of the production core test scope.', filename: 'development-preview' },
];

const runCoreFlows = async (page, viewport) => {
  await page.getByRole('button', { name: 'BOM Editor' }).click();
  await page.locator('main').getByText('BOM Editor').first().waitFor();
  await page.getByRole('button', { name: /Add Item/i }).click();
  await page.getByRole('button', { name: /Existing library part/i }).click();
  await page.getByLabel('Library Part').waitFor();
  await page.screenshot({ path: join(outputDir, `${viewport.name}-bom-add-flow.png`), fullPage: true });
  await page.getByLabel('Close add item').click();

  await page.getByRole('button', { name: 'Part Library' }).click();
  await page.locator('main').getByText('Library Filters').first().waitFor();
  await page.getByPlaceholder('Search by Part Number, MPN, Description...').fill('Qualcomm');
  await page.getByLabel('Sort parts').selectOption('supplier');
  await page.locator('main').getByText('100-55512-A').first().waitFor();
  await page.screenshot({ path: join(outputDir, `${viewport.name}-part-library-search-sort.png`), fullPage: true });

  await page.getByRole('button', { name: 'Tooling Hub' }).click();
  await page.locator('main').getByText('Tooling Records').first().waitFor();
  await page.getByRole('button', { name: 'Details' }).first().click();
  await page.getByRole('button', { name: /links/i }).click();
  await page.getByRole('button', { name: /Open in Part Library/i }).first().click();
  await page.locator('main').getByText('Library Filters').first().waitFor();
  await page.waitForFunction(() => (
    Array.from(document.querySelectorAll('input')).some((input) => input.value === 'ZP-A-STD-COVER-BLK')
  ));
  await page.screenshot({ path: join(outputDir, `${viewport.name}-tooling-to-part-library.png`), fullPage: true });
};

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
});

const results = [];

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
    page.setDefaultTimeout(15000);
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    for (const target of pages) {
      await page.getByRole('button', { name: target.nav }).click();
      await page.locator('main').getByText(target.proof).first().waitFor();

      const screenshotPath = join(outputDir, `${viewport.name}-${target.filename}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      results.push({
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        nav: target.nav,
        proof: target.proof,
        screenshotPath,
        pass: true,
      });
    }

    await runCoreFlows(page, viewport);
    results.push({
      viewport: viewport.name,
      width: viewport.width,
      height: viewport.height,
      nav: 'Core production flows',
      proof: 'BOM add flow, supplier search/sort, and Tooling to Part Library link',
      screenshotPath: join(outputDir, `${viewport.name}-tooling-to-part-library.png`),
      pass: true,
    });

    await page.close();
  }
} finally {
  await browser.close();
}

const resultPath = 'docs/user-tests/20260605-core-modules-production-usecase-check/browser-qa.json';
await writeFile(resultPath, JSON.stringify({
  baseUrl,
  chromePath,
  generatedAt: new Date().toISOString(),
  results,
}, null, 2));

console.log(`Core browser QA passed for ${results.length} checks.`);
console.log(`Results: ${resultPath}`);
