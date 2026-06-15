## ADDED Requirements

### Requirement: Admin connects Google Ads account via OAuth2 authorization code flow
The config page SHALL provide a "Conectar Google Ads" button that initiates a standard OAuth2 authorization code flow. Admins SHALL NOT manually enter refresh tokens or customer IDs. After OAuth completes, the system SHALL fetch all accessible Google Ads accounts and present a picker page. The selected account's customer ID and the obtained refresh token are stored together.

#### Scenario: Admin initiates OAuth flow
- **WHEN** admin clicks "Conectar Google Ads" on the config page
- **THEN** browser navigates to `GET /api/admin/google-ads/auth?accountId={id}`, which sets an httpOnly CSRF state cookie and redirects to the Google OAuth2 consent screen

#### Scenario: Successful OAuth callback — redirects to account picker
- **WHEN** Google redirects to `/api/admin/google-ads/callback?code=...&state=...` after the admin grants access
- **THEN** the system verifies the state matches the cookie nonce, exchanges the code for tokens, calls `listAccessibleCustomers` with the access token, stores the account list and encrypted refresh token in a temp `gads_select` cookie (10 min TTL), clears the CSRF cookie, and redirects to `/admin/google-ads/select-account?accountId={id}`

#### Scenario: Account picker shows accessible accounts
- **WHEN** the admin lands on `/admin/google-ads/select-account`
- **THEN** the page fetches `GET /api/admin/google-ads/accounts` (which reads the `gads_select` cookie) and displays a list of accessible Google Ads accounts with their names and IDs

#### Scenario: Admin selects an account
- **WHEN** the admin picks an account and confirms
- **THEN** `POST /api/admin/google-ads/select-account` reads the `gads_select` cookie, saves `googleAdsCustomerId` and the encrypted refresh token to `ButtonConfig`, clears the cookie, and the client redirects to `/admin/config?accountId={id}&connected=1`

#### Scenario: OAuth callback with mismatched or missing state
- **WHEN** the callback arrives with a `state` that does not match the stored nonce, or the cookie is absent/expired
- **THEN** the system returns 400 and does NOT store any token

#### Scenario: Admin reconnects — existing token and account replaced
- **WHEN** admin clicks "Reconectar Google Ads" while already connected
- **THEN** the OAuth flow runs again; admin goes through account picker; new customer ID and refresh token overwrite the existing ones

#### Scenario: Admin disconnects
- **WHEN** admin clicks "Desconectar" and the `POST /api/admin/google-ads/disconnect` call succeeds
- **THEN** both `googleAdsRefreshToken` and `googleAdsCustomerId` are set to `NULL` on `ButtonConfig` and future enrichments will be `SKIPPED`

### Requirement: Refresh token encrypted at rest
The system SHALL encrypt `googleAdsRefreshToken` using AES-256-GCM before persisting to the database. Decryption SHALL only occur inside the Google Ads lib at call time. The encryption key SHALL be derived from the `GOOGLE_ADS_TOKEN_ENCRYPTION_KEY` env var.

#### Scenario: Token stored encrypted
- **WHEN** the OAuth callback stores a refresh token
- **THEN** the value in the database is the AES-256-GCM ciphertext, not the plaintext token

#### Scenario: Token decrypted at enrichment time
- **WHEN** `enrichLeadFromGclid` reads the refresh token from `ButtonConfig`
- **THEN** it decrypts the ciphertext using `GOOGLE_ADS_TOKEN_ENCRYPTION_KEY` before use

#### Scenario: Missing encryption key env var
- **WHEN** `GOOGLE_ADS_TOKEN_ENCRYPTION_KEY` is not set
- **THEN** the system MUST throw at startup or at first use — it SHALL NOT silently store or use plaintext tokens

### Requirement: Config page shows Google Ads connection status
The config page SHALL display whether Google Ads credentials are currently configured for the account. It SHALL show a "Configurado" indicator when both `googleAdsCustomerId` and `googleAdsRefreshToken` are present, and "Não configurado" otherwise. The config page SHALL NOT contain a manual customer ID input. The refresh token value SHALL never be returned to the client — only a boolean `hasGoogleAdsRefreshToken`.

#### Scenario: Credentials present — connected state shown
- **WHEN** `ButtonConfig` has non-null `googleAdsCustomerId` and `googleAdsRefreshToken`
- **THEN** the config page displays a green "Configurado" badge, the selected account name/ID, and "Reconectar" + "Desconectar" buttons

#### Scenario: Credentials absent — not configured state shown
- **WHEN** `ButtonConfig` has null `googleAdsCustomerId` or `googleAdsRefreshToken`
- **THEN** the config page displays a grey "Não configurado" badge and a "Conectar Google Ads" button (no text input for customer ID)

#### Scenario: Success banner after OAuth redirect
- **WHEN** config page loads with `?connected=1` in the URL
- **THEN** a success banner is displayed confirming the connection

#### Scenario: Error banner after failed OAuth
- **WHEN** config page loads with `?oauth_error=...` in the URL
- **THEN** an error banner is displayed with the error description

### Requirement: Developer token is global via env var
The Google Ads developer token SHALL be read from `GOOGLE_ADS_DEVELOPER_TOKEN` environment variable only. It SHALL NOT be stored per-account or exposed via any API response.

#### Scenario: Developer token read from env at enrichment time
- **WHEN** `enrichLeadFromGclid` constructs the Google Ads API request
- **THEN** the `developer-token` header value is read from `process.env.GOOGLE_ADS_DEVELOPER_TOKEN`

#### Scenario: Developer token never returned in API responses
- **WHEN** any admin API endpoint returns `ButtonConfig` data
- **THEN** `GOOGLE_ADS_DEVELOPER_TOKEN` value is absent from the response body

### Requirement: OAuth endpoints require admin session (except callback)
`GET /api/admin/google-ads/auth` and `POST /api/admin/google-ads/disconnect` SHALL require an active admin session. The callback endpoint (`GET /api/admin/google-ads/callback`) is protected by the CSRF state cookie instead of session, since Google redirects to it directly.

#### Scenario: Unauthenticated auth initiation rejected
- **WHEN** an unauthenticated request is made to `GET /api/admin/google-ads/auth`
- **THEN** the API returns 401

#### Scenario: Unauthenticated disconnect rejected
- **WHEN** an unauthenticated request is made to `POST /api/admin/google-ads/disconnect`
- **THEN** the API returns 401
