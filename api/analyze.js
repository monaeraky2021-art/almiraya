export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body || {};
  const subject = body.subject || "";
  const grade = body.grade || "";
  const topic = body.topic || "";
  const plan = body.plan || "";

  if (!subject || !grade || !topic || !plan) {
    return res.status(400).json({ error: "Missing fields" });
  }

  const counts = body.counts || {};
  const countsText = Object.entries(counts).filter(([,v]) => v).map(([k,v]) => `${k}:${v}`).join(", ");

  const prompt = `You are an expert teacher trainer. Analyze this lesson for 5 student types. Respond in the same language as the lesson content. Return ONLY valid JSON, no other text.

Subject: ${subject}
Grade: ${grade}
Topic: ${topic}
Lesson plan: ${plan}
${countsText ? `Student counts - ${countsText}` : ""}

Return ONLY this JSON:
{"average":{"confusion":"2 sentences","questions":["q1","q2","q3"],"intervention":"1 sentence"},"advanced":{"confusion":"2 sentences","questions":["q1","q2","q3"],"intervention":"1 sentence"},"weak":{"confusion":"2 sentences","questions":["q1","q2","q3"],"intervention":"1 sentence"},"language":{"confusion":"2 sentences","questions":["q1","q2","q3"],"intervention":"1 sentence"},"distracted":{"confusion":"2 sentences","questions":["q1","q2","q3"],"intervention":"1 sentence"}}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({ error: err?.error?.message || "API error" });
    }

    const data = await response.json();
    const text = data?.content?.map(b => b.text || "").join("") || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "No JSON found" });

    let parsed;
    try { parsed = JSON.parse(match[0]); }
    catch { 
      const fixed = match[0].replace(/,(\s*[}\]])/g, "$1");
      try { parsed = JSON.parse(fixed); }
      catch { return res.status(500).json({ error: "JSON parse error" }); }
    }

    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
