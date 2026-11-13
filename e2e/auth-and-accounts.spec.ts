import { expect, test } from '@playwright/test'

test('crée une identité personnelle, ajoute une entreprise, change de compte puis se reconnecte', async ({ page }) => {
  const suffix = `${Date.now()}${test.info().workerIndex}`
  const personal = {
    name: `Personnel E2E ${suffix}`,
    username: `perso-e2e-${suffix}`,
    email: `perso-e2e-${suffix}@example.test`,
    password: 'E2e-password-123!',
  }
  const organization = {
    name: `Entreprise E2E ${suffix}`,
    owner: `Propriétaire E2E ${suffix}`,
    username: `org-e2e-${suffix}`,
    email: `org-e2e-${suffix}@example.test`,
    password: 'E2e-password-456!',
  }

  await page.goto('/signup')
  await page.getByRole('button', { name: 'Perso — usage personnel' }).click()
  await page.getByLabel('Votre nom').fill(personal.name)
  await page.getByLabel("Nom d'utilisateur").fill(personal.username)
  await page.getByLabel('Email').fill(personal.email)
  await page.getByLabel('Mot de passe').fill(personal.password)
  await page.getByRole('button', { name: 'Créer mon espace' }).click()

  await expect(page).toHaveURL(/\/inbox$/)
  await expect(page.getByRole('button', { name: new RegExp(`Compte actif : ${personal.name}`) })).toBeVisible()

  await page.getByRole('button', { name: new RegExp(`Compte actif : ${personal.name}`) }).click()
  await page.getByRole('menuitem', { name: 'Ajouter un compte' }).click()
  await page.getByRole('button', { name: 'Créer une entreprise' }).click()

  await page.getByLabel("Nom de l'organisation").fill(organization.name)
  await page.getByLabel('Votre nom').fill(organization.owner)
  await page.getByLabel("Nom d'utilisateur").fill(organization.username)
  await page.getByLabel('Email').fill(organization.email)
  await page.getByLabel('Mot de passe').fill(organization.password)
  await page.getByRole('button', { name: 'Continuer' }).click()

  await expect(page.getByRole('dialog', { name: 'Connecter Resend' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Connecter Resend' }).getByRole('button', { name: 'Fermer' }).click()
  await expect(page.getByRole('button', { name: new RegExp(`Compte actif : ${organization.name}`) })).toBeVisible()

  await page.getByRole('button', { name: new RegExp(`Compte actif : ${organization.name}`) }).click()
  await page.getByRole('menuitemradio', { name: personal.name }).click()
  await expect(page).toHaveURL(/\/inbox$/)
  await expect(page.getByRole('button', { name: new RegExp(`Compte actif : ${personal.name}`) })).toBeVisible()

  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
  await page.goto('/login')
  await page.getByLabel("Nom d'utilisateur").fill(personal.username)
  await page.getByLabel('Mot de passe').fill(personal.password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()

  await expect(page).toHaveURL(/\/inbox$/)
  await expect(page.getByRole('button', { name: new RegExp(`Compte actif : ${personal.name}`) })).toBeVisible()
})
