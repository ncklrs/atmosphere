import type { Page } from "@playwright/test";
export async function openLabPanels(page: Page, waitForLab = false) {
  if (waitForLab)
    await page
      .getByText("Fine tuning", { exact: true })
      .waitFor({ state: "visible" });
  for (const name of ["Fine tuning", "Audio experiments"]) {
    const summary = page.getByText(name, { exact: true });
    if (await summary.count()) {
      const open = await summary.evaluate((el) => el.closest("details")?.open);
      if (!open) await summary.click();
    }
  }
}
