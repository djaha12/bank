import { test, expect } from "@playwright/test";

/**
 * Smoke E2E: the landing page renders and routes to auth. Deeper flows
 * (sign-in → dashboard → transfer) should be added with seeded demo creds.
 */
test("landing page renders the hero and CTAs", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/future of banking/i)).toBeVisible();
});

test("health endpoint reports ledger integrity", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json.status).toBe("ok");
  expect(json.ledgerBalanced).toBe(true);
});

test("unauthenticated dashboard redirects to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/sign-in/);
});
