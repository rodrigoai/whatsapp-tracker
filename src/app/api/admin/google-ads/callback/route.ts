import { NextResponse } from "next/server"
import { encryptToken, listAccessibleCustomers } from "@/lib/google-ads"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/admin/config?oauth_error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return new NextResponse("Parâmetros inválidos", { status: 400 })
  }

  const cookieHeader = request.headers.get("cookie") ?? ""
  const cookieMatch = cookieHeader.split(";").map(c => c.trim()).find(c => c.startsWith("gads_oauth="))
  const cookieValue = cookieMatch?.split("=").slice(1).join("=")

  if (!cookieValue) {
    return new NextResponse("Cookie de estado ausente ou expirado", { status: 400 })
  }

  const colonIndex = cookieValue.indexOf(":")
  const accountId = cookieValue.slice(0, colonIndex)
  const storedNonce = cookieValue.slice(colonIndex + 1)

  if (!accountId || state !== storedNonce) {
    return new NextResponse("Falha na verificação de estado CSRF", { status: 400 })
  }

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/admin/google-ads/callback`

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "Google OAuth2 client not configured" }, { status: 500 })
  }

  const clearOauthCookie = "gads_oauth=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/"

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    console.error("[google-ads oauth] token exchange failed:", body)
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin/config?accountId=${accountId}&oauth_error=token_exchange_failed`,
      { headers: { "Set-Cookie": clearOauthCookie } }
    )
  }

  const tokens = (await tokenRes.json()) as { refresh_token?: string; access_token?: string }

  if (!tokens.refresh_token || !tokens.access_token) {
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/admin/config?accountId=${accountId}&oauth_error=no_refresh_token`,
      { headers: { "Set-Cookie": clearOauthCookie } }
    )
  }

  let accounts: { id: string; name: string }[] = []
  try {
    accounts = await listAccessibleCustomers(tokens.access_token)
  } catch (err) {
    console.error("[google-ads oauth] listAccessibleCustomers failed:", err)
    // Still proceed to picker with empty list — user can retry
  }

  const encrypted = encryptToken(tokens.refresh_token)
  const payload = Buffer.from(
    JSON.stringify({ configAccountId: accountId, encryptedRefreshToken: encrypted, accounts })
  ).toString("base64")

  const selectCookie = `gads_select=${payload}; HttpOnly; SameSite=Lax; Max-Age=600; Path=/`

  const res = NextResponse.redirect(
    `${process.env.NEXTAUTH_URL}/admin/google-ads/select-account?accountId=${accountId}`
  )
  res.headers.append("Set-Cookie", clearOauthCookie)
  res.headers.append("Set-Cookie", selectCookie)
  return res
}
