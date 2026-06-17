## ADDED Requirements

### Requirement: Lambda derives today's date in UTC and sends it to the batch enrichment API
The Lambda function SHALL compute the current date in UTC (`YYYY-MM-DD`) at invocation time and call `POST /api/lambda/enrich-batch` with body `{ "date": "<today-utc>" }`.

#### Scenario: Invocation at any time sends today's UTC date
- **WHEN** the Lambda is invoked by EventBridge at any time of day
- **THEN** the function computes the current UTC date as `YYYY-MM-DD` and sends it as the `date` field in the request body

#### Scenario: Date is always UTC regardless of server timezone
- **WHEN** the host environment has a non-UTC timezone configured
- **THEN** the function MUST still derive the date in UTC (not local time)

### Requirement: Lambda authenticates requests with a shared bearer secret
The Lambda function SHALL read `LAMBDA_API_SECRET` from its environment and include `Authorization: Bearer <LAMBDA_API_SECRET>` on every request to the batch enrichment API.

#### Scenario: Secret present — header sent
- **WHEN** `LAMBDA_API_SECRET` is set in the Lambda environment
- **THEN** every outbound request includes `Authorization: Bearer <value>` matching that variable

#### Scenario: Secret missing — Lambda exits with error before calling API
- **WHEN** `LAMBDA_API_SECRET` is not set (empty or undefined)
- **THEN** the function MUST throw an error and terminate without calling the API

### Requirement: Lambda reads the target API URL from an environment variable
The Lambda function SHALL read `BATCH_ENRICHMENT_API_URL` from its environment to construct the full endpoint URL (`<BATCH_ENRICHMENT_API_URL>/api/lambda/enrich-batch`).

#### Scenario: URL env var present — request sent to correct endpoint
- **WHEN** `BATCH_ENRICHMENT_API_URL` is set (e.g. `https://tracker.example.com`)
- **THEN** the POST request is sent to `<BATCH_ENRICHMENT_API_URL>/api/lambda/enrich-batch`

#### Scenario: URL env var missing — Lambda exits with error
- **WHEN** `BATCH_ENRICHMENT_API_URL` is not set
- **THEN** the function MUST throw an error and terminate without calling the API

### Requirement: Lambda logs invocation outcome to stdout
The Lambda function SHALL log the API response (HTTP status, `queued` count on success, or error body on failure) to stdout so CloudWatch captures it.

#### Scenario: Successful API call — logs queued count
- **WHEN** the API responds with `202` and `{ "queued": N }`
- **THEN** the function logs a message including the queued count and exits successfully (exit code 0 / no thrown error)

#### Scenario: API returns non-2xx — logs error and throws
- **WHEN** the API responds with any non-2xx status (e.g. 401, 503)
- **THEN** the function logs the status and response body, then throws an error so Lambda marks the invocation as failed and CloudWatch Alarms can trigger

#### Scenario: Network error — logs error and throws
- **WHEN** the HTTP request fails due to a network issue (timeout, DNS failure)
- **THEN** the function logs the error and throws so the invocation is marked failed

### Requirement: Lambda is triggered by EventBridge cron twice daily
The Lambda function SHALL be associated with two EventBridge rules: one at 12:00 UTC and one at 23:59 UTC, every day. The 23:59 schedule ensures leads registered late in the day are captured before midnight.

#### Scenario: Midday run triggers at 12:00 UTC
- **WHEN** the clock reaches 12:00 UTC on any day
- **THEN** EventBridge invokes the Lambda function

#### Scenario: End-of-day run triggers at 23:59 UTC
- **WHEN** the clock reaches 23:59 UTC on any day
- **THEN** EventBridge invokes the Lambda function

#### Scenario: No other scheduled invocations
- **WHEN** the time is anything other than 12:00 or 23:59 UTC
- **THEN** the Lambda is NOT invoked by the cron schedule
