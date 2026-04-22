// Edge function: streaming AI domain detective via Lovable AI Gateway.
// Hybrid data: real DNS via Google DoH + AI-narrated WHOIS/SSL/threat findings.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ChatMsg = { role: "user" | "assistant"; content: string };

function extractDomain(text: string): string | null {
  const m = text.match(
    /\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})\b/i,
  );
  return m ? m[1].toLowerCase() : null;
}

async function dnsLookup(domain: string, type: string) {
  try {
    const r = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
      { headers: { accept: "application/dns-json" } },
    );
    if (!r.ok) return null;
    const j = await r.json();
    return j.Answer?.map((a: { data: string }) => a.data) ?? [];
  } catch {
    return null;
  }
}

async function gatherDnsContext(domain: string) {
  const [a, aaaa, mx, ns, txt] = await Promise.all([
    dnsLookup(domain, "A"),
    dnsLookup(domain, "AAAA"),
    dnsLookup(domain, "MX"),
    dnsLookup(domain, "NS"),
    dnsLookup(domain, "TXT"),
  ]);
  return { a, aaaa, mx, ns, txt };
}

const SYSTEM_PROMPT = `You are the Detective, a calm, sharp domain forensics AI. You speak like a quietly confident investigator — minimal, precise, never robotic or corporate.

RULES:
- Keep responses tight (3–6 sentences). No bullet lists unless absolutely needed.
- Reveal findings conversationally, referencing real data when provided.
- Use ✓ for safe, ⚠ for caution, ✗ for danger — sparingly.
- For legit domains: be reassuring and specific.
- For sketchy domains (typosquats, very new, no MX, suspicious NS): explain WHY clearly.
- End with one short follow-up question.
- If user asks something not domain-related, gently steer them back.
- Plain prose only. No JSON, no code blocks.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = (await req.json()) as { messages: ChatMsg[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const domain = lastUser ? extractDomain(lastUser.content) : null;
    let evidence = "";
    if (domain) {
      const dns = await gatherDnsContext(domain);
      evidence = `\n\n[REAL DNS EVIDENCE for ${domain}]
A: ${dns.a?.join(", ") || "none"}
AAAA: ${dns.aaaa?.join(", ") || "none"}
MX: ${dns.mx?.join(", ") || "none (suspicious for a real business)"}
NS: ${dns.ns?.join(", ") || "none"}
TXT: ${dns.txt?.slice(0, 3).join(" | ") || "none"}
Use these to ground your investigation. Infer registrar/age plausibly from NS patterns.`;
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT + evidence },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!aiResp.ok || !aiResp.body) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded — try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Lovable Cloud settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({ error: `AI gateway ${aiResp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = aiResp.body!.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buf = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf("\n")) !== -1) {
              const line = buf.slice(0, idx).trim();
              buf = buf.slice(idx + 1);
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (payload === "[DONE]") continue;
              try {
                const j = JSON.parse(payload);
                const delta = j.choices?.[0]?.delta?.content;
                if (delta) controller.enqueue(encoder.encode(delta));
              } catch { /* ignore */ }
            }
          }
        } catch (e) {
          console.error("stream err", e);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (e) {
    console.error(e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
