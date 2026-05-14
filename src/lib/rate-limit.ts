type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function isRateLimited(
  key: string,
  options: { limit: number; windowMs: number },
  now = Date.now()
) {
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return false;
  }

  bucket.count += 1;
  return bucket.count > options.limit;
}

export function resetRateLimitForTests() {
  buckets.clear();
}
