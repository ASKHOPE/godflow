export const prerender = false;

export async function GET({ url }) {
  const target = url.searchParams.get("url")?.trim();
  if (!target || !/^https?:\/\//i.test(target)) {
    return new Response(JSON.stringify({ ok: false, error: "Provide a valid http(s) URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const res = await fetch(target, {
      headers: { "User-Agent": "GodFlow-Crawler/1.0 (+https://godflow.media)" },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, error: `Upstream HTTP ${res.status}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" }
      });
    }
    const html = await res.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || "";
    const desc =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i)?.[1]?.trim() ||
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["']/i)?.[1]?.trim() ||
      "";
    const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .filter((p) => p.length > 40)
      .slice(0, 5);
    const body = paragraphs.join("\n\n") || desc || `Crawled content from ${target}`;
    const domain = new URL(target).hostname.replace(/^www\./, "");

    return new Response(
      JSON.stringify({ ok: true, url: target, domain, title: title || domain, summary: desc || paragraphs[0] || "", body }),
      { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || "Crawl failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
