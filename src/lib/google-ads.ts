import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto"
import { prisma } from "@/lib/prisma"

const ALGORITHM = "aes-256-gcm"
const KEY_LEN = 32

function getDerivedKey(): Buffer {
  const secret = process.env.GOOGLE_ADS_TOKEN_ENCRYPTION_KEY
  if (!secret) throw new Error("GOOGLE_ADS_TOKEN_ENCRYPTION_KEY env var not set")
  return scryptSync(secret, "gads-salt", KEY_LEN)
}

export function encryptToken(plaintext: string): string {
  const key = getDerivedKey()
  const iv = randomBytes(16)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":")
}

export function decryptToken(ciphertext: string): string {
  const key = getDerivedKey()
  const [ivHex, authTagHex, encryptedHex] = ciphertext.split(":")
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error("Invalid ciphertext format")
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")
  const encrypted = Buffer.from(encryptedHex, "hex")
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8")
}

async function exchangeRefreshToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("Google OAuth2 client credentials not configured")

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${body}`)
  }

  const data = (await res.json()) as { access_token?: string }
  if (!data.access_token) throw new Error("Token exchange response missing access_token")
  return data.access_token
}

type ClickViewResult = {
  campaign_id: string | null
  campaign_name: string | null
  ad_group_id: string | null
  ad_group_name: string | null
  gclid_keyword: string | null
  gclid_match_type: string | null
  gclid_ad_id: string | null
  gclid_click_date: string | null
  gclid_ad_network_type: string | null
  gclid_page_number: number | null
  gclid_geo_interest_country: string | null
  gclid_geo_interest_region: string | null
  gclid_geo_presence_country: string | null
  gclid_geo_presence_region: string | null
}

// ClickView requires a single-day date filter — DURING LAST_N_DAYS is rejected.
async function queryClickView(
  customerId: string,
  accessToken: string,
  gclid: string,
  date: string  // YYYY-MM-DD
): Promise<ClickViewResult | null> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN env var not set")

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      click_view.keyword_info.text,
      click_view.keyword_info.match_type,
      click_view.ad_group_ad,
      click_view.page_number,
      click_view.area_of_interest.country,
      click_view.area_of_interest.region,
      click_view.location_of_presence.country,
      click_view.location_of_presence.region,
      segments.ad_network_type,
      segments.date
    FROM click_view
    WHERE click_view.gclid = '${gclid.replace(/'/g, "\\'")}'
    AND segments.date = '${date}'
  `.trim()

  const cleanCustomerId = customerId.replace(/-/g, "")
  const res = await fetch(
    `https://googleads.googleapis.com/v24/customers/${cleanCustomerId}/googleAds:search`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
      body: JSON.stringify({ query }),
    }
  )

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Google Ads API error (${res.status}): ${body}`)
  }

  const data = (await res.json()) as {
    results?: Array<{
      campaign?: { id?: string; name?: string }
      adGroup?: { id?: string; name?: string }
      clickView?: {
        keywordInfo?: { text?: string; matchType?: string }
        adGroupAd?: string
        pageNumber?: number | string
        areaOfInterest?: { country?: string; region?: string }
        locationOfPresence?: { country?: string; region?: string }
      }
      segments?: { adNetworkType?: string; date?: string }
    }>
  }

  if (!data.results || data.results.length === 0) return null

  const row = data.results[0]
  const adGroupAdResource = row.clickView?.adGroupAd ?? null
  const adId = adGroupAdResource ? adGroupAdResource.split("/").pop() ?? null : null

  return {
    campaign_id: row.campaign?.id ?? null,
    campaign_name: row.campaign?.name ?? null,
    ad_group_id: row.adGroup?.id ?? null,
    ad_group_name: row.adGroup?.name ?? null,
    gclid_keyword: row.clickView?.keywordInfo?.text ?? null,
    gclid_match_type: row.clickView?.keywordInfo?.matchType ?? null,
    gclid_ad_id: adId,
    gclid_click_date: row.segments?.date ?? null,
    gclid_ad_network_type: row.segments?.adNetworkType ?? null,
    gclid_page_number: row.clickView?.pageNumber != null ? parseInt(String(row.clickView.pageNumber), 10) : null,
    gclid_geo_interest_country: row.clickView?.areaOfInterest?.country ?? null,
    gclid_geo_interest_region: row.clickView?.areaOfInterest?.region ?? null,
    gclid_geo_presence_country: row.clickView?.locationOfPresence?.country ?? null,
    gclid_geo_presence_region: row.clickView?.locationOfPresence?.region ?? null,
  }
}

export async function listAccessibleCustomers(
  accessToken: string
): Promise<{ id: string; name: string }[]> {
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN
  if (!developerToken) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN env var not set")

  const listRes = await fetch(
    "https://googleads.googleapis.com/v24/customers:listAccessibleCustomers",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
    }
  )

  if (!listRes.ok) {
    const body = await listRes.text()
    throw new Error(`listAccessibleCustomers failed (${listRes.status}): ${body}`)
  }

  const listData = (await listRes.json()) as { resourceNames?: string[] }
  const resourceNames = listData.resourceNames ?? []

  const results: { id: string; name: string }[] = []
  for (const resourceName of resourceNames) {
    const id = resourceName.split("/").pop()
    if (!id) continue
    try {
      const nameRes = await fetch(
        `https://googleads.googleapis.com/v24/customers/${id}/googleAds:search`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "developer-token": developerToken,
          },
          body: JSON.stringify({
            query: "SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1",
          }),
        }
      )
      if (nameRes.ok) {
        const nameData = (await nameRes.json()) as {
          results?: Array<{ customer?: { id?: string; descriptiveName?: string } }>
        }
        const customer = nameData.results?.[0]?.customer
        results.push({ id, name: customer?.descriptiveName ?? id })
      } else {
        results.push({ id, name: id })
      }
    } catch {
      results.push({ id, name: id })
    }
  }

  return results
}

function toDateString(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, "0")
  const d = String(date.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export async function enrichLeadFromGclid(
  leadId: string,
  gclid: string,
  accountId: string
): Promise<void> {
  try {
    const [config, customer] = await Promise.all([
      prisma.buttonConfig.findUnique({ where: { accountId } }),
      prisma.customer.findUnique({ where: { id: leadId }, select: { conversionTime: true } }),
    ])

    if (!config?.googleAdsCustomerId || !config?.googleAdsRefreshToken) {
      await prisma.customer.update({
        where: { id: leadId },
        data: { enrichment_status: "SKIPPED", enrichment_error: "Google Ads credentials not configured for this account" },
      })
      return
    }

    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
      await prisma.customer.update({
        where: { id: leadId },
        data: { enrichment_status: "SKIPPED", enrichment_error: "Google Ads developer token not configured" },
      })
      return
    }

    const refreshToken = decryptToken(config.googleAdsRefreshToken)
    const accessToken = await exchangeRefreshToken(refreshToken)

    // ClickView requires a single-day filter. Search backward from conversion date
    // up to gclidExpirationDays (the window during which the gclid could have been clicked).
    const startDate = customer?.conversionTime ?? new Date()
    const maxDays = Math.min(config.gclidExpirationDays ?? 30, 90)
    let result: ClickViewResult | null = null

    for (let i = 0; i < maxDays; i++) {
      const d = new Date(startDate)
      d.setUTCDate(d.getUTCDate() - i)
      result = await queryClickView(config.googleAdsCustomerId, accessToken, gclid, toDateString(d))
      if (result) break
    }

    if (!result) {
      await prisma.customer.update({
        where: { id: leadId },
        data: { enrichment_status: "FAILED", enrichment_error: "No ClickView data found for gclid" },
      })
      return
    }

    await prisma.customer.update({
      where: { id: leadId },
      data: { ...result, enrichment_status: "ENRICHED", enrichment_error: null },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[google-ads] enrichment failed for lead ${leadId}:`, message)
    try {
      await prisma.customer.update({
        where: { id: leadId },
        data: { enrichment_status: "FAILED", enrichment_error: message.slice(0, 500) },
      })
    } catch {
      // best-effort — never throw out of enrichLeadFromGclid
    }
  }
}
