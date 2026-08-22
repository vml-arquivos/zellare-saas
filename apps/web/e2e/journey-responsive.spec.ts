import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

const evidenceDir =
  process.env.E2E_EVIDENCE_DIR ?? "test-results/journey-responsive";
mkdirSync(evidenceDir, { recursive: true });
const password = process.env.E2E_PASSWORD ?? "synthetic-e2e-password-2026";
const email = process.env.E2E_EMAIL ?? "journey-admissions@example.invalid";
const tabs = [
  ["Visão geral", "/app/journey"],
  ["Interessados", "/app/journey/interessados"],
  ["Funil", "/app/journey/funil"],
  ["Visitas", "/app/journey/visitas"],
  ["Lista de espera", "/app/journey/lista-espera"],
  ["Ofertas de vaga", "/app/journey/ofertas"],
  ["Relatórios", "/app/journey/relatorios"],
] as const;
const viewports = [320, 360, 390, 412, 768, 1280] as const;

test.use({
  video: "on",
  contextOptions: {
    recordHar: {
      path: `${evidenceDir}/journey-responsive-raw.har`,
      mode: "minimal",
    },
  },
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/e-mail/i).fill(email);
  await page.getByLabel(/senha/i).fill(password);
  await page.getByRole("button", { name: /entrar|login/i }).click();
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
}

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  expect(
    dimensions.scrollWidth,
    JSON.stringify(dimensions),
  ).toBeLessThanOrEqual(dimensions.viewport);
  expect(
    dimensions.bodyScrollWidth,
    JSON.stringify(dimensions),
  ).toBeLessThanOrEqual(dimensions.viewport);
}

test("Journey autenticada percorre abas, persiste cadastro e reflowa em 320/360/390/412/768 e desktop", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      consoleErrors.push(`${response.status()} ${response.url()}`);
    }
  });
  await login(page);
  await page.goto("/app/journey");
  await expect(
    page.getByRole("heading", { name: "Visão geral" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Jornada e Admissões" }),
  ).toBeVisible();

  for (const width of viewports) {
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await expect(
      page.getByRole("navigation", { name: "Jornada e Admissões" }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await page.screenshot({
      path: `${evidenceDir}/journey-overview-${width}.png`,
      fullPage: true,
    });
  }

  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/app/journey/interessados");
  await expect(
    page.getByRole("heading", { name: "Interessados" }).first(),
  ).toBeVisible();
  await page
    .getByRole("textbox", { name: "Responsável", exact: true })
    .fill("Persistência Visual Sintética");
  await page
    .getByRole("textbox", { name: "Criança prospectiva", exact: true })
    .fill("Criança Visual Sintética");
  await page
    .getByRole("textbox", { name: "E-mail", exact: true })
    .fill("visual.synthetic@example.invalid");
  await page.getByLabel("Consentimento para registro da captação.").check();
  await page.getByLabel(/Consentimento para contato/).check();
  await page.getByRole("button", { name: "Cadastrar interessado" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Interessado cadastrado",
  );
  await page.reload();
  await expect(
    page
      .locator("p")
      .filter({ hasText: "Persistência Visual Sintética" })
      .first(),
  ).toBeVisible();
  await assertNoHorizontalOverflow(page);

  for (const [label, path] of tabs) {
    await page
      .getByRole("navigation", { name: "Jornada e Admissões" })
      .getByRole("link", { name: label, exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`${path.replaceAll("/", "\\/")}(?:\\?.*)?$`),
    );
    await expect(
      page.getByRole("navigation", { name: "Jornada e Admissões" }),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
  }

  await page.screenshot({
    path: `${evidenceDir}/journey-reports-768.png`,
    fullPage: true,
  });
  writeFileSync(
    `${evidenceDir}/journey-console.log`,
    consoleErrors.length === 0 ? "CLEAN\n" : `${consoleErrors.join("\n")}\n`,
  );
  expect(consoleErrors).toEqual([]);
});
