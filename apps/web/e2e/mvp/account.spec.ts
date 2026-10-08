// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Accounts and the profile in the cloud (F4 MVP, ADR-0029), with the fake login of the e2e build
// (src/auth/fake-session.ts, `vite build --mode e2e`): the same flow as with Cognito (button,
// callback, menu, dialogs), with the account in sessionStorage and the profile in a table in
// sessionStorage, read with the same schemas as DynamoDB. Nothing reaches AWS.
import { expect, test, type Page } from "@playwright/test";
import { expectNoBlockingViolations } from "../support/axe";
import { headerRank, onboard, placeAll, playFromListing, finish } from "../support/app";
import { AREAS, CLUB_PHOTOS, EXPERIENCE, RANKS } from "../support/fixture";

const { store, thumbnailer, index } = CLUB_PHOTOS.slots;

/** Keys of src/auth/fake-session.ts. */
const FAKE_TABLE_KEY = "blueprint.fake-cloud";
const FAKE_IDENTITY_ID = "us-east-2:00000000-0000-4000-8000-000000000000";
const NOW = "2026-10-08T12:00:00.000Z";

const signIn = async (page: Page) => {
  await page.getByRole("button", { name: "Ingresar o crear cuenta" }).click();
};

const accountButton = (page: Page, name = "Tu cuenta") =>
  page.getByRole("banner").getByRole("button", { name: `Cuenta de ${name}` });

const fakeTable = (page: Page) =>
  page.evaluate(
    (key) => JSON.parse(sessionStorage.getItem(key) ?? "{}") as Record<string, unknown>,
    FAKE_TABLE_KEY,
  );

test("un invitado crea su cuenta: su progreso sube a la nube y sigue al recargar", async ({
  page,
}) => {
  await test.step("jugar como invitado", async () => {
    await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
    await playFromListing(page, CLUB_PHOTOS.title);
    await placeAll(page, [store, thumbnailer, index]);
    await finish(page);
    await page.getByRole("link", { name: "Ver escenarios" }).click();
    await expect(headerRank(page)).toHaveText(`Rango:${RANKS.second}`);
  });

  await test.step("ingresar vuelve a la misma pantalla y sube el progreso", async () => {
    await signIn(page);
    await expect(page).toHaveURL(/\/escenarios$/);
    await expect(
      page.getByText("Subimos a tu cuenta el progreso de este navegador."),
    ).toBeVisible();
    await expect(accountButton(page)).toBeVisible();
    await expect(headerRank(page)).toHaveText(`Rango:${RANKS.second}`);
    const table = await fakeTable(page);
    expect(table.profile).toMatchObject({ xp: 300, completed: [CLUB_PHOTOS.id] });
  });

  await test.step("el menú de la cuenta, con el teclado", async () => {
    await accountButton(page).focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu).toContainText("jugador@example.com");
    await expect(menu).toContainText("300 XP");
    await expect(page.getByRole("menuitem", { name: "Cambiar nombre visible" })).toBeFocused();
    await expectNoBlockingViolations(page, "menú de la cuenta");
    await page.keyboard.press("Enter");
  });

  await test.step("cambiar el nombre visible", async () => {
    const dialog = page.getByRole("dialog", { name: "Nombre visible" });
    await expect(dialog).toBeVisible();
    const field = dialog.getByRole("textbox", { name: "Nombre visible" });
    await expect(field).toBeFocused();
    await dialog.getByRole("button", { name: "Guardar" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Escribí un nombre.");
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expectNoBlockingViolations(page, "diálogo del nombre visible");
    await field.fill("Ada");
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(accountButton(page, "Ada")).toBeFocused();
    expect((await fakeTable(page)).profile).toMatchObject({ displayName: "Ada" });
  });

  await test.step("recargar mantiene la sesión de la pestaña y el progreso de la nube", async () => {
    await page.reload();
    await expect(accountButton(page, "Ada")).toBeVisible();
    await expect(headerRank(page)).toHaveText(`Rango:${RANKS.second}`);
  });

  await test.step("cerrar sesión vuelve al progreso de este navegador", async () => {
    await accountButton(page, "Ada").click();
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
    await expect(page.getByRole("button", { name: "Ingresar o crear cuenta" })).toBeVisible();
    // The guest progress of this browser was never touched.
    await expect(headerRank(page)).toHaveText(`Rango:${RANKS.second}`);
  });
});

test("una cuenta que ya tiene progreso usa el de la nube y no lo mezcla", async ({ page }) => {
  // An account that already played: 2.500 XP (Arquitecto) on its profile.
  await page.addInitScript(
    ({ key, pk, now }) => {
      if (sessionStorage.getItem(key) !== null) return;
      sessionStorage.setItem(
        key,
        JSON.stringify({
          profile: {
            pk,
            sk: "profile",
            schemaVersion: 1,
            displayName: "Grace",
            xp: 2500,
            completed: [],
            progress: {
              schemaVersion: 2,
              progress: {
                experience: "expert",
                interests: ["serverless"],
                xp: 2500,
                best: {},
                unlocked: [],
                started: [],
              },
            },
            createdAt: now,
            updatedAt: now,
          },
        }),
      );
    },
    { key: FAKE_TABLE_KEY, pk: FAKE_IDENTITY_ID, now: NOW },
  );
  await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
  await expect(headerRank(page)).toHaveText(`Rango:${RANKS.first}`);

  await signIn(page);
  await expect(accountButton(page, "Grace")).toBeVisible();
  await expect(headerRank(page)).toHaveText("Rango:Arquitecto");
  await expect(page.getByText("Subimos a tu cuenta el progreso de este navegador.")).toBeHidden();
  expect((await fakeTable(page)).profile).toMatchObject({ xp: 2500 });

  await accountButton(page, "Grace").click();
  await page.getByRole("menuitem", { name: "Cerrar sesión" }).click();
  await expect(headerRank(page)).toHaveText(`Rango:${RANKS.first}`);
});

test("«Eliminar mi cuenta» borra el perfil de la nube y vuelve a invitado", async ({ page }) => {
  await onboard(page, { areas: [AREAS.serverless], experience: EXPERIENCE.beginner });
  await signIn(page);
  await expect(accountButton(page)).toBeVisible();
  expect(Object.keys(await fakeTable(page))).toEqual(["profile"]);

  await accountButton(page).click();
  await page.getByRole("menuitem", { name: "Eliminar mi cuenta" }).click();
  const confirm = page.getByRole("alertdialog", { name: "¿Eliminar tu cuenta?" });
  await expect(confirm).toBeVisible();
  await expectNoBlockingViolations(page, "confirmación de eliminar la cuenta");

  await test.step("cancelar no borra nada", async () => {
    await confirm.getByRole("button", { name: "Cancelar" }).click();
    await expect(confirm).toBeHidden();
    expect(Object.keys(await fakeTable(page))).toEqual(["profile"]);
  });

  await accountButton(page).click();
  await page.getByRole("menuitem", { name: "Eliminar mi cuenta" }).click();
  await confirm.getByRole("button", { name: "Eliminar mi cuenta" }).click();
  await expect(page.getByText("Eliminamos tu cuenta y tus datos.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Ingresar o crear cuenta" })).toBeVisible();
  expect(await fakeTable(page)).toEqual({});
});
