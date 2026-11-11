import { expect, test } from '@playwright/test'

test('neautorizirani korisnik dolazi na sigurnu prijavu', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle('FinTrack')
  await expect(page.getByText('FinTrack').first()).toBeVisible()
  await expect(page.getByText(/Supabase još nije konfiguriran|Prijavite se u FinTrack/)).toBeVisible()
})

test('PWA manifest je dostupan', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBeTruthy()
  const manifest = await response.json()
  expect(manifest.name).toContain('FinTrack')
  expect(manifest.display).toBe('standalone')
})
