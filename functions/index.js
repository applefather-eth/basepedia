const { onRequest } = require("firebase-functions/v2/https");
const { readFileSync, existsSync } = require("node:fs");
const { join } = require("node:path");
const { Resvg } = require("@resvg/resvg-js");

const SITE_URL = "https://basepedia.web.app";
const APP_NAME = "Basepedia";
const DEFAULT_DESCRIPTION = "An agent-curated encyclopedia for every project on Base, powered by Hermes Agent.";
const rootDir = __dirname;

let satoriPromise;
let fontRegular;
let fontBold;
let indexHtml;
let logoDataUri;

function getSatori() {
  if (!satoriPromise) {
    satoriPromise = import("satori").then((module) => module.default);
  }
  return satoriPromise;
}

function getFont(name) {
  if (name === "bold") {
    fontBold ??= readFileSync(join(rootDir, "assets/NotoSans-Bold.ttf"));
    return fontBold;
  }

  fontRegular ??= readFileSync(join(rootDir, "assets/NotoSans-Regular.ttf"));
  return fontRegular;
}

function getIndexHtml() {
  indexHtml ??= readFileSync(join(rootDir, "static/index.html"), "utf8");
  return indexHtml;
}

function getLogoDataUri() {
  if (!logoDataUri) {
    const logo = readFileSync(join(rootDir, "public/basepedia-logo.png"));
    logoDataUri = `data:image/png;base64,${logo.toString("base64")}`;
  }

  return logoDataUri;
}

function normalizeSlug(value) {
  return String(value ?? "")
    .replace(/^\$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function titleFromSlug(slug) {
  return normalizeSlug(slug)
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractSlug(req, prefix) {
  const rawPath = (req.originalUrl || req.url || "").split("?")[0];
  const [, slug = ""] = rawPath.split(prefix);
  return normalizeSlug(slug.split("/")[0]);
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  const frontmatter = {};
  if (!match) return frontmatter;

  match[1].split("\n").forEach((line) => {
    const index = line.indexOf(":");
    if (index > -1) {
      frontmatter[line.slice(0, index).trim()] = line.slice(index + 1).trim();
    }
  });

  return frontmatter;
}

function stripMarkdown(value) {
  return String(value ?? "")
    .replace(/^---[\s\S]*?---\s*/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_>#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(markdown, fallback) {
  const quote = markdown.match(/^>\s+(.+)$/m)?.[1];
  const text = stripMarkdown(quote || markdown);
  if (!text) return fallback;
  return text.length > 160 ? `${text.slice(0, 157).trim()}...` : text;
}

function readWiki(slug) {
  const wikiDir = join(rootDir, "content/tokens", normalizeSlug(slug));
  const markdownPath = join(wikiDir, "index.md");
  if (!existsSync(markdownPath)) {
    const title = titleFromSlug(slug) || APP_NAME;
    return {
      slug,
      title,
      ticker: "",
      description: `Request a Basepedia wiki page for ${title}.`,
      exists: false,
    };
  }

  const markdown = readFileSync(markdownPath, "utf8");
  const metaPath = join(wikiDir, "meta.json");
  const meta = existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, "utf8")) : {};
  const frontmatter = parseFrontmatter(markdown);
  const title = meta.title || frontmatter.title || titleFromSlug(slug) || APP_NAME;

  return {
    ...frontmatter,
    ...meta,
    slug,
    title,
    ticker: meta.ticker || frontmatter.ticker || "",
    description: meta.description || excerpt(markdown, `An agent-curated encyclopedia article for ${title} on Base.`),
    exists: true,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function replaceMeta(html, property, content) {
  const escaped = escapeHtml(content);
  const propertyPattern = new RegExp(`<meta\\s+property="${property}"\\s+content="[^"]*"\\s*/?>`);
  const namePattern = new RegExp(`<meta\\s+name="${property}"\\s+content="[^"]*"\\s*/?>`);
  if (propertyPattern.test(html)) {
    return html.replace(propertyPattern, `<meta property="${property}" content="${escaped}" />`);
  }
  if (namePattern.test(html)) {
    return html.replace(namePattern, `<meta name="${property}" content="${escaped}" />`);
  }
  return html.replace("</head>", `    <meta property="${property}" content="${escaped}" />\n  </head>`);
}

function injectTokenMeta(slug) {
  const wiki = readWiki(slug);
  const pageUrl = `${SITE_URL}/tokens/${wiki.slug}`;
  const imageUrl = `${SITE_URL}/api/og/${wiki.slug}`;
  const title = `${wiki.title} | ${APP_NAME}`;
  const description = wiki.description || DEFAULT_DESCRIPTION;

  let html = getIndexHtml();
  html = html.replace(/<title>.*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
  html = replaceMeta(html, "description", description);
  html = replaceMeta(html, "og:title", title);
  html = replaceMeta(html, "og:description", description);
  html = replaceMeta(html, "og:url", pageUrl);
  html = replaceMeta(html, "og:image", imageUrl);
  html = replaceMeta(html, "twitter:title", title);
  html = replaceMeta(html, "twitter:description", description);
  html = replaceMeta(html, "twitter:image", imageUrl);
  return html;
}

function ogMarkup(wiki) {
  const title = wiki.title || APP_NAME;
  const ticker = wiki.ticker ? `$${wiki.ticker}` : "Base project";
  const description = wiki.description || DEFAULT_DESCRIPTION;

  return {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: "#0a0b0f",
        color: "#ffffff",
        padding: "62px 72px",
        fontFamily: "Noto Sans",
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", alignItems: "center", gap: "22px" },
            children: [
              {
                type: "img",
                props: {
                  src: getLogoDataUri(),
                  width: 92,
                  height: 92,
                  style: { borderRadius: "24px" },
                },
              },
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column" },
                  children: [
                    { type: "div", props: { style: { fontSize: 28, fontWeight: 700 }, children: APP_NAME } },
                    {
                      type: "div",
                      props: {
                        style: { marginTop: 4, color: "#05df3d", fontSize: 20, fontWeight: 700 },
                        children: "Hermes Agent verified",
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    color: "#05df3d",
                    fontSize: 28,
                    fontWeight: 700,
                    marginBottom: 14,
                  },
                  children: ticker,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    maxWidth: 960,
                    fontSize: title.length > 22 ? 78 : 92,
                    fontWeight: 700,
                    lineHeight: 0.96,
                    letterSpacing: "-1px",
                  },
                  children: title,
                },
              },
              {
                type: "div",
                props: {
                  style: {
                    maxWidth: 910,
                    marginTop: 28,
                    color: "#a5a5a5",
                    fontSize: 30,
                    lineHeight: 1.32,
                  },
                  children: description,
                },
              },
            ],
          },
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "#777777",
              fontSize: 22,
              fontWeight: 700,
            },
            children: [
              "basepedia.web.app",
              wiki.exists ? `/tokens/${wiki.slug}` : "Request this wiki page",
            ],
          },
        },
      ],
    },
  };
}

exports.tokenPage = onRequest({ region: "us-central1" }, (req, res) => {
  const slug = extractSlug(req, "/tokens/");
  res
    .status(200)
    .set("Cache-Control", "public, max-age=300, s-maxage=600")
    .type("html")
    .send(injectTokenMeta(slug));
});

exports.ogImage = onRequest({ region: "us-central1", memory: "512MiB" }, async (req, res) => {
  try {
    const slug = extractSlug(req, "/api/og/");
    const wiki = readWiki(slug);
    const satori = await getSatori();
    const svg = await satori(ogMarkup(wiki), {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Noto Sans", data: getFont("regular"), weight: 400, style: "normal" },
        { name: "Noto Sans", data: getFont("bold"), weight: 700, style: "normal" },
      ],
    });
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
    }).render().asPng();

    res
      .status(200)
      .set("Cache-Control", "public, max-age=3600, s-maxage=86400")
      .type("png")
      .send(Buffer.from(png));
  } catch (error) {
    console.error(error);
    res.status(500).send("Could not render OG image");
  }
});
