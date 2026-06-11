import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { requireAdminSession } from "@/lib/admin"

export async function GET(request: Request) {
  const unauthorized = await requireAdminSession()
  if (unauthorized) return unauthorized

  const accountId = new URL(request.url).searchParams.get("accountId")
  if (!accountId) return new NextResponse("ID da conta ausente", { status: 400 })

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/admin/google-ads/callback`
  if (!clientId || !redirectUri) {
    return NextResponse.json({ error: "Google OAuth2 client not configured" }, { status: 500 })
  }

  const nonce = randomUUID()
  const cookieValue = `${accountId}:${nonce}`

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  authUrl.searchParams.set("response_type", "code")
  authUrl.searchParams.set("client_id", clientId)
  authUrl.searchParams.set("redirect_uri", redirectUri)
  authUrl.searchParams.set("scope", "https://www.googleapis.com/auth/adwords")
  authUrl.searchParams.set("access_type", "offline")
  authUrl.searchParams.set("prompt", "consent")
  authUrl.searchParams.set("state", nonce)

  return NextResponse.redirect(authUrl.toString(), {
    headers: {
      "Set-Cookie": `gads_oauth=${cookieValue}; HttpOnly; SameSite=Lax; Max-Age=300; Path=/`,
    },
  })
}
