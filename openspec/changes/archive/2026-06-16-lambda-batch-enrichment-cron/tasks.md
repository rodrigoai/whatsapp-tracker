## 1. Lambda Function

- [x] 1.1 Create `lambda/enrich-batch/handler.mjs` with env var validation (exit if `LAMBDA_API_SECRET` or `BATCH_ENRICHMENT_API_URL` missing)
- [x] 1.2 Implement UTC date derivation via `new Date().toISOString().split('T')[0]`
- [x] 1.3 Implement `POST /api/lambda/enrich-batch` call with `Authorization: Bearer` header and `{ date }` body
- [x] 1.4 Log success response (status + `queued` count) to stdout
- [x] 1.5 Log error response (status + body) to stdout and throw so Lambda marks invocation as failed

## 2. Unit Tests

- [x] 2.1 Create `lambda/enrich-batch/handler.test.mjs` with `fetch` mocked
- [x] 2.2 Test: env var missing → throws before calling API
- [x] 2.3 Test: 202 response → logs queued count, no throw
- [x] 2.4 Test: non-2xx response → logs error, throws
- [x] 2.5 Test: network error → logs error, throws
- [x] 2.6 Test: correct UTC date sent in request body

## 3. SAM Template

- [x] 3.1 Delete `terraform/` directory
- [x] 3.2 Create `lambda/template.yaml` — SAM `AWS::Serverless::Function` resource (runtime `nodejs24.x`, handler `enrich-batch/handler.handler`, region `us-east-1`)
- [x] 3.3 Add `LAMBDA_API_SECRET` and `BATCH_ENRICHMENT_API_URL` as SAM Parameters wired into Lambda environment
- [x] 3.4 Add IAM execution role with `AWSLambdaBasicExecutionRole` policy via SAM `Policies` property
- [x] 3.5 Add CloudWatch log group with 30-day retention as a `AWS::Logs::LogGroup` resource
- [x] 3.6 Add EventBridge schedule for 12:00 UTC (`cron(0 12 * * ? *)`) via SAM `Events` on the function
- [x] 3.7 Add EventBridge schedule for 23:59 UTC (`cron(59 23 * * ? *)`) via SAM `Events` on the function
- [x] 3.8 Create `lambda/samconfig.toml` with stack name, region (`us-east-1`), and parameter keys
