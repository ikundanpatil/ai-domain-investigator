// Edge function: streaming AI cyber-detective investigator using Claude.
// Hybrid data: real DNS via Google DoH + AI-narrated WHOIS/SSL/threat findings.
import "https://deno.land/x/xhr@0.1.0/mod.ts";

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

const SYSTEM_PROMPT = `You are NEON, an elite cybersecurity detective AI. You speak like a sharp, slightly witty noir investigator texting a friend — never robotic, never corporate.

RULES:
- Keep responses tight (4–8 sentences usually). No bullet lists unless absolutely needed.
- Reveal findings conversationally, like you just dug them up. Reference real data when provided.
- Use occasional emoji sparingly: ✓ for safe, ⚠️ for caution, ✗ for danger.
- For legit domains: be reassuring and specific.
- For sketchy domains (typosquats, very new, no MX, suspicious NS): warn naturally and explain WHY.
- Always end with a short follow-up question to keep the investigation going.
- If user asks something not domain-related, gently steer them back: "I'm built for domain forensics — give me one to dig into."
- Never output JSON or code blocks. Plain prose only.`;

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

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Pull domain from latest user message and fetch real DNS as evidence.
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

    const anthropicResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 600,
        stream: true,
        system: SYSTEM_PROMPT + evidence,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!anthropicResp.ok || !anthropicResp.body) {
      const t = await anthropicResp.text();
      console.error("Anthropic error", anthropicResp.status, t);
      return new Response(
        JSON.stringify({ error: `Anthropic ${anthropicResp.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Convert Anthropic SSE -> simple text stream of token deltas.
    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicResp.body!.getReader();
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
              try {
                const j = JSON.parse(payload);
                if (
                  j.type === "content_block_delta" &&
                  j.delta?.type === "text_delta" &&
                  j.delta.text
                ) {
                  controller.enqueue(encoder.encode(j.delta.text));
                }
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
