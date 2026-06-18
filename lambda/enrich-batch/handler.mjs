export async function handler() {
  const secret = process.env.API_SECRET;
  const apiUrl = process.env.BATCH_ENRICHMENT_API_URL;

  if (!secret) throw new Error("Missing env var: API_SECRET");
  if (!apiUrl) throw new Error("Missing env var: BATCH_ENRICHMENT_API_URL");

  const date = new Intl.DateTimeFormat("fr-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  const url = `${apiUrl}/api/lambda/enrich-batch`;

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ date }),
    });
  } catch (err) {
    console.error("Network error calling batch enrichment API:", err.message);
    throw err;
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`Batch enrichment API error: ${res.status}`, body);
    throw new Error(`API responded with ${res.status}`);
  }

  console.log(`Batch enrichment queued for ${date}: ${body.queued} leads`);
}
