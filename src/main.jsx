import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { marked } from "marked";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Coins,
  ExternalLink,
  Globe2,
  Heart,
  MessageCircle,
  Moon,
  RefreshCw,
  Search,
  Sparkles,
  Sun,
  Twitter,
  Zap,
} from "lucide-react";
import { wikiPages } from "./content/wiki-pages";
import "./styles.css";

const API_BASE = "https://api.bankr.bot";

function compactUsd(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  });
  return formatter.format(Number(value));
}

function compactNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value));
}

function tokenPrice(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const number = Number(value);
  if (number > 0 && number < 0.01) return `$${number.toPrecision(4)}`;
  return compactUsd(number);
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  const number = Number(value);
  const abs = Math.abs(number);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;
  return `${number > 0 ? "+" : ""}${number.toFixed(digits)}%`;
}

function formatRelativeTime(date, now = Date.now()) {
  const diffSeconds = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(diffSeconds);
  const units = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const [unit, seconds] = units.find(([, size]) => abs >= size) ?? ["second", 1];
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(diffSeconds / seconds), unit);
}

function formatExactDate(date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function initials(name = "?") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return response.json();
}

function ProjectAvatar({ image, name, className = "avatar-wrap" }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={className}>
      {image && !failed ? (
        <img src={image} alt="" onError={() => setFailed(true)} />
      ) : (
        <span>{initials(name)}</span>
      )}
    </div>
  );
}

async function fetchOptional(url) {
  try {
    return await fetchJson(url);
  } catch {
    return null;
  }
}

async function loadProjects() {
  const [agents, tokenPage] = await Promise.all([
    fetchJson(`${API_BASE}/agent-profiles?sort=marketCap&limit=100`),
    fetchJson(`${API_BASE}/discover?sortBy=marketCapUsd&order=desc&limit=100`),
  ]);

  const tokenByAddress = new Map(
    (tokenPage.results ?? []).map((token) => [token.tokenAddress?.toLowerCase(), token]),
  );

  return (agents.profiles ?? []).map((profile) => {
    const token = tokenByAddress.get(profile.tokenAddress?.toLowerCase());
    return {
      ...profile,
      liveToken: token,
      marketCapUsd: token?.marketCapUsd ?? profile.marketCapUsd,
      volume24h: token?.vol24h,
      priceChange24h: token?.priceChange24h,
      txCount24h: token?.txCount24h,
      image: profile.profileImageUrl || token?.imageUri,
    };
  });
}

async function loadProjectDetail(tokenAddress, fallbackProject) {
  const [profile, tokenData, marketCap, tweets, llmUsage, fees] = await Promise.all([
    fetchOptional(`${API_BASE}/agent-profiles/${tokenAddress}`),
    fetchOptional(`${API_BASE}/discover/${tokenAddress}`),
    fetchOptional(`${API_BASE}/agent-profiles/${tokenAddress}/market-cap`),
    fetchOptional(`${API_BASE}/agent-profiles/${tokenAddress}/tweets`),
    fetchOptional(`${API_BASE}/agent-profiles/${tokenAddress}/llm-usage?days=30`),
    fetchOptional(`${API_BASE}/public/doppler/token-fees/${tokenAddress}?days=30`),
  ]);

  const token = tokenData?.token;
  return {
    ...(fallbackProject ?? {}),
    ...(profile ?? {}),
    liveToken: token,
    marketCapUsd: marketCap?.marketCapUsd ?? token?.marketCapUsd ?? profile?.marketCapUsd ?? fallbackProject?.marketCapUsd,
    volume24h: token?.vol24h ?? fallbackProject?.volume24h,
    priceChange24h: token?.priceChange24h ?? fallbackProject?.priceChange24h,
    txCount24h: token?.txCount24h ?? fallbackProject?.txCount24h,
    lastPriceUsd: token?.lastPriceUsd,
    lastTradeAt: token?.lastTradeAt,
    poolId: token?.poolId,
    image: profile?.profileImageUrl || fallbackProject?.image || token?.imageUri,
    tweets: tweets?.tweets ?? [],
    llmUsage,
    fees,
  };
}

function ThemeToggle({ theme, onToggle }) {
  const isLight = theme === "light";
  return (
    <button className="theme-toggle" onClick={onToggle} aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}>
      {isLight ? <Moon size={15} /> : <Sun size={15} />}
      <span>{isLight ? "dark" : "light"}</span>
    </button>
  );
}

function navigateTo(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function tokenWikiPath(project) {
  const raw = project.tokenSymbol || project.slug || project.projectName || project.tokenAddress;
  const slug = String(raw ?? "")
    .replace(/^\$/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return slug ? `/tokens/${slug}` : "";
}

function SearchNav({ theme, onThemeToggle, compact = false }) {
  return (
    <nav className={`nav ${compact ? "compact-nav" : ""}`}>
      <a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigateTo("/"); }}>
        <span className="brand-mark">
          <img src="/bankr-logo.svg" alt="" aria-hidden="true" />
        </span>
        <span>Bankrpedia</span>
      </a>
      <div className="nav-actions">
        <a className="nav-link" href="/discover" onClick={(event) => { event.preventDefault(); navigateTo("/discover"); }}>
          discover
        </a>
        <ThemeToggle theme={theme} onToggle={onThemeToggle} />
      </div>
    </nav>
  );
}

function HomePage({ projects, theme, onThemeToggle, query, onQueryChange }) {
  const examples = projects.slice(0, 4);

  const submitSearch = (event) => {
    event.preventDefault();
    const term = query.trim();
    navigateTo(term ? `/discover?q=${encodeURIComponent(term)}` : "/discover");
  };

  return (
    <main className="home-page">
      <SearchNav theme={theme} onThemeToggle={onThemeToggle} compact />

      <section className="home-search">
        <img className="home-logo" src="/bankr-logo.svg" alt="" aria-hidden="true" />
        <h1>Bankrpedia</h1>
        <p>An agent-curated encyclopedia for every project on Base, powered by Hermes Agent.</p>

        <form className="home-search-form" onSubmit={submitSearch}>
          <label className="home-search-box">
            <Search size={22} />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search Bankrpedia"
              autoFocus
            />
          </label>
          <button type="submit">Search</button>
        </form>

        <div className="home-links">
          <a href="/discover" onClick={(event) => { event.preventDefault(); navigateTo("/discover"); }}>
            Browse all projects
          </a>
          {examples.map((project) => (
            <button key={project.id ?? project.slug} type="button" onClick={() => navigateTo(`/discover?q=${encodeURIComponent(project.projectName ?? "")}`)}>
              {project.projectName}
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}

function ProjectCard({ project, rank }) {
  const change = project.priceChange24h;
  const positive = Number(change) >= 0;
  const tokenPath = tokenWikiPath(project);

  return (
    <article
      className="project-card"
      role="link"
      tabIndex={0}
      onClick={() => tokenPath && navigateTo(tokenPath)}
      onKeyDown={(event) => {
        if ((event.key === "Enter" || event.key === " ") && tokenPath) navigateTo(tokenPath);
      }}
    >
      <div className="rank">#{rank}</div>
      <div className="project-top">
        <ProjectAvatar image={project.image} name={project.projectName} />
        <div className="project-name">
          <h2>{project.projectName}</h2>
          <p>{project.tokenSymbol ? `$${project.tokenSymbol}` : project.slug}</p>
        </div>
      </div>

      <p className="description">{project.description || "No public description yet."}</p>

      <div className="metrics">
        <div>
          <span>Market cap</span>
          <strong>{compactUsd(project.marketCapUsd)}</strong>
        </div>
        <div>
          <span>24h volume</span>
          <strong>{compactUsd(project.volume24h)}</strong>
        </div>
        <div>
          <span>24h</span>
          <strong className={positive ? "positive" : "negative"}>
            {positive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
            {formatPercent(change)}
          </strong>
        </div>
      </div>

      <div className="card-footer">
        <div className="revenue">
          <span>7d revenue</span>
          <strong>{project.weeklyRevenueWeth ? `${Number(project.weeklyRevenueWeth).toFixed(3)} WETH` : "-"}</strong>
        </div>
        <div className="links">
          {project.twitterUsername && (
            <a href={`https://x.com/${project.twitterUsername}`} target="_blank" rel="noreferrer" aria-label="Open X profile" onClick={(event) => event.stopPropagation()}>
              <Twitter size={17} />
            </a>
          )}
          {project.website && (
            <a href={project.website} target="_blank" rel="noreferrer" aria-label="Open website" onClick={(event) => event.stopPropagation()}>
              <Globe2 size={17} />
            </a>
          )}
          {tokenPath && (
            <a
              href={tokenPath}
              aria-label="Open token wiki"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                navigateTo(tokenPath);
              }}
            >
              <ExternalLink size={17} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function MiniMetric({ icon: Icon, label, value, tone = "neutral" }) {
  return (
    <div className={`mini-metric mini-${tone}`}>
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InfoList({ title, items, empty }) {
  return (
    <section className="detail-panel">
      <h3>{title}</h3>
      {items?.length ? (
        <div className="info-list">{items}</div>
      ) : (
        <p className="empty">{empty}</p>
      )}
    </section>
  );
}

function parseWikiMarkdown(markdown) {
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n?/);
  const frontmatter = {};
  const body = markdown.replace(/^---[\s\S]*?---\s*/, "");

  if (frontmatterMatch) {
    frontmatterMatch[1].split("\n").forEach((line) => {
      const index = line.indexOf(":");
      if (index > -1) {
        frontmatter[line.slice(0, index).trim()] = line.slice(index + 1).trim();
      }
    });
  }

  const sections = [...body.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim());
  const articleMarkdown = body
    .replace(/^#\s+.+\n+/, "")
    .replace(/^>\s+Basepedia-style project article[^\n]*\n+/, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1");
  const html = marked.parse(articleMarkdown).replace(/<h([23])>(.*?)<\/h\1>/g, (_match, level, text) => {
    const plain = text.replace(/<[^>]+>/g, "");
    const id = plain.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return `<h${level} id="${id}">${text}</h${level}>`;
  });

  return {
    frontmatter,
    title: body.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? frontmatter.title ?? "Gitlawb",
    sections,
    html,
  };
}

function TokenWikiPage({ page, theme, onThemeToggle }) {
  const wiki = useMemo(() => parseWikiMarkdown(page.markdown), [page.markdown]);
  const updatedAt = useMemo(() => new Date(page.updatedAt), [page.updatedAt]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const updatedLabel = formatRelativeTime(updatedAt, now);
  const exactUpdatedAt = formatExactDate(updatedAt);

  return (
    <main className="grok-page">
      <SearchNav theme={theme} onThemeToggle={onThemeToggle} compact />

      <section className="grok-shell">
        <aside className="grok-toc">
          <span>Contents</span>
          {wiki.sections.slice(0, 12).map((section) => (
            <a href={`#${section.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`} key={section}>
              {section}
            </a>
          ))}
        </aside>

        <article className="grok-article">
          <div className="grok-kicker" title={exactUpdatedAt}>
            <Sparkles size={14} />
            <span>Fact-checked by Hermes Agent</span>
            <span>Last updated {updatedLabel}</span>
          </div>
          <h1>{wiki.title}</h1>
          <p className="grok-subtitle">An agent-curated encyclopedia article for {wiki.title} on Base.</p>

          <div className="grok-content" dangerouslySetInnerHTML={{ __html: wiki.html }} />
        </article>
      </section>
    </main>
  );
}

function ProjectDetail({ tokenAddress, fallbackProject, onBack, theme, onThemeToggle }) {
  const [detail, setDetail] = useState(fallbackProject ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    loadProjectDetail(tokenAddress, fallbackProject)
      .then((nextDetail) => {
        if (!cancelled) setDetail(nextDetail);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load project detail");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tokenAddress, fallbackProject]);

  const project = detail ?? {};
  const change = project.priceChange24h;
  const positive = Number(change) >= 0;
  const latestTweets = project.tweets?.slice(0, 4) ?? [];
  const teamMembers = project.teamMembers ?? [];
  const products = project.products ?? [];
  const feeToken = project.fees?.tokens?.[0];

  return (
    <main>
      <nav className="nav detail-nav">
        <button className="nav-link button-link" onClick={onBack}>
          <ArrowLeft size={15} /> back
        </button>
        <div className="nav-actions">
          <ThemeToggle theme={theme} onToggle={onThemeToggle} />
          <a className="brand" href="/" onClick={(event) => { event.preventDefault(); navigateTo("/"); }}>
            <span className="brand-mark">
              <img src="/bankr-logo.svg" alt="" aria-hidden="true" />
            </span>
            <span>Bankrpedia</span>
          </a>
        </div>
      </nav>

      {error && <div className="notice">Bankr API returned: {error}</div>}

      <section className="detail-hero">
        <div className="detail-copy">
        <div className="detail-avatar">
            <ProjectAvatar image={project.image} name={project.projectName} className="detail-avatar-inner" />
          </div>
          <div className="eyebrow">
            <Sparkles size={15} /> {project.tokenChainId ?? "base"} project
          </div>
          <h1>{project.projectName ?? "Loading project..."}</h1>
          <p>{project.description || (loading ? "Pulling live Bankr project data..." : "No public description yet.")}</p>
          <div className="detail-actions">
            {project.twitterUsername && (
              <a href={`https://x.com/${project.twitterUsername}`} target="_blank" rel="noreferrer">
                <Twitter size={16} /> x.com/{project.twitterUsername}
              </a>
            )}
            {project.website && (
              <a href={project.website} target="_blank" rel="noreferrer">
                <Globe2 size={16} /> website
              </a>
            )}
            <a href={`https://bankr.bot/discover/${tokenAddress}`} target="_blank" rel="noreferrer">
              <ExternalLink size={16} /> bankr
            </a>
          </div>
        </div>

        <div className="detail-market-card">
          <span className="token-pill">{project.tokenSymbol ? `$${project.tokenSymbol}` : tokenAddress.slice(0, 8)}</span>
          <strong>{compactUsd(project.marketCapUsd)}</strong>
          <p>market cap</p>
          <div className="detail-price-row">
            <span>{tokenPrice(project.lastPriceUsd)}</span>
            <span className={positive ? "positive" : "negative"}>
              {positive ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
              {formatPercent(change)}
            </span>
          </div>
        </div>
      </section>

      <section className="detail-metrics">
        <MiniMetric icon={BarChart3} label="24h volume" value={compactUsd(project.volume24h)} tone="green" />
        <MiniMetric icon={Zap} label="24h txns" value={compactNumber(project.txCount24h)} />
        <MiniMetric icon={Coins} label="7d revenue" value={project.weeklyRevenueWeth ? `${Number(project.weeklyRevenueWeth).toFixed(3)} WETH` : "-"} tone="green" />
        <MiniMetric icon={CalendarDays} label="created" value={project.createdAt ? new Date(project.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-"} />
      </section>

      <section className="detail-grid">
        <section className="detail-panel token-panel">
          <h3>Token</h3>
          <dl>
            <div><dt>Address</dt><dd>{tokenAddress}</dd></div>
            <div><dt>Pool</dt><dd>{project.poolId ?? "-"}</dd></div>
            <div><dt>Claimable</dt><dd>{project.fees?.totals?.claimableWeth ? `${project.fees.totals.claimableWeth} WETH` : "-"}</dd></div>
            <div><dt>Lifetime fees</dt><dd>{project.fees?.lifetimeEarnedWeth ? `${project.fees.lifetimeEarnedWeth} WETH` : "-"}</dd></div>
            <div><dt>Fee share</dt><dd>{feeToken?.share ?? "-"}</dd></div>
          </dl>
        </section>

        <InfoList
          title="Team"
          empty="No team members published."
          items={teamMembers.map((member) => (
            <div className="person" key={`${member.name}-${member.role}`}>
              <strong>{member.name}</strong>
              <span>{member.role}</span>
            </div>
          ))}
        />

        <InfoList
          title="Products"
          empty="No products published."
          items={products.map((product) => (
            <a className="product-row" href={product.url ?? "#"} target="_blank" rel="noreferrer" key={product.name ?? product.url}>
              <strong>{product.name ?? "Product"}</strong>
              <span>{product.description ?? product.url ?? "No description"}</span>
            </a>
          ))}
        />

        <InfoList
          title="Recent tweets"
          empty="No recent tweets available."
          items={latestTweets.map((tweet) => (
            <a className="tweet-row" href={tweet.url} target="_blank" rel="noreferrer" key={tweet.id}>
              <p>{tweet.text}</p>
              <span>
                <Heart size={13} /> {compactNumber(tweet.metrics?.likes)} <MessageCircle size={13} /> {compactNumber(tweet.metrics?.replies)}
              </span>
            </a>
          ))}
        />

        <section className="detail-panel usage-panel">
          <h3>LLM usage</h3>
          <div className="usage-total">
            <strong>{compactNumber(project.llmUsage?.totals?.totalTokens)}</strong>
            <span>tokens in 30 days</span>
          </div>
          <div className="model-list">
            {(project.llmUsage?.byModel ?? []).slice(0, 3).map((model) => (
              <div key={model.model}>
                <span>{model.model}</span>
                <strong>{compactNumber(model.totalTokens)}</strong>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(() => new URLSearchParams(window.location.search).get("q") || "");
  const [sort, setSort] = useState("marketCapUsd");
  const [refreshing, setRefreshing] = useState(false);
  const [path, setPath] = useState(window.location.pathname);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "dark");

  const refresh = async () => {
    setError("");
    setRefreshing(true);
    try {
      const nextProjects = await loadProjects();
      setProjects(nextProjects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Bankr projects");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    const handlePop = () => {
      setPath(window.location.pathname);
      setQuery(new URLSearchParams(window.location.search).get("q") || "");
    };
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const visibleProjects = useMemo(() => {
    const term = query.trim().toLowerCase();
    return projects
      .filter((project) => {
        if (!term) return true;
        return [
          project.projectName,
          project.description,
          project.tokenSymbol,
          project.twitterUsername,
          project.website,
          project.tokenAddress,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      })
      .sort((a, b) => {
        if (sort === "newest") return new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0);
        if (sort === "revenue") return Number(b.weeklyRevenueWeth ?? 0) - Number(a.weeklyRevenueWeth ?? 0);
        if (sort === "volume24h") return Number(b.volume24h ?? 0) - Number(a.volume24h ?? 0);
        return Number(b.marketCapUsd ?? 0) - Number(a.marketCapUsd ?? 0);
      });
  }, [projects, query, sort]);

  const tokenMatch = path.match(/^\/tokens\/([^/]+)$/);
  if (tokenMatch) {
    const tokenSlug = decodeURIComponent(tokenMatch[1]).toLowerCase();
    const wikiPage = wikiPages[tokenSlug];
    if (wikiPage) {
      return (
        <TokenWikiPage
          page={wikiPage}
          theme={theme}
          onThemeToggle={() => setTheme((current) => current === "light" ? "dark" : "light")}
        />
      );
    }

    return (
      <main>
        <SearchNav theme={theme} onThemeToggle={() => setTheme((current) => current === "light" ? "dark" : "light")} compact />
        <div className="notice">No wiki page found for {tokenSlug}.</div>
      </main>
    );
  }

  const detailMatch = path.match(/^\/projects\/([^/]+)$/);
  if (detailMatch) {
    const tokenAddress = decodeURIComponent(detailMatch[1]);
    return (
      <ProjectDetail
        tokenAddress={tokenAddress}
        fallbackProject={projects.find((project) => project.tokenAddress?.toLowerCase() === tokenAddress.toLowerCase())}
        onBack={() => navigateTo("/discover")}
        theme={theme}
        onThemeToggle={() => setTheme((current) => current === "light" ? "dark" : "light")}
      />
    );
  }

  if (path === "/") {
    return (
      <HomePage
        projects={projects}
        theme={theme}
        onThemeToggle={() => setTheme((current) => current === "light" ? "dark" : "light")}
        query={query}
        onQueryChange={setQuery}
      />
    );
  }

  return (
    <main className="listing-page">
      <header className="hero">
        <SearchNav theme={theme} onThemeToggle={() => setTheme((current) => current === "light" ? "dark" : "light")} compact />
      </header>

      <section className="toolbar">
        <label className="search-box">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects, tickers, addresses..."
          />
        </label>

        <div className="sort-tabs" aria-label="Sort projects">
          {[
            ["marketCapUsd", "market cap"],
            ["volume24h", "volume"],
            ["revenue", "revenue"],
            ["newest", "newest"],
          ].map(([value, label]) => (
            <button key={value} className={sort === value ? "active" : ""} onClick={() => setSort(value)}>
              {label}
            </button>
          ))}
        </div>

        <button className="refresh" onClick={refresh} disabled={refreshing}>
          <RefreshCw size={16} className={refreshing ? "spin" : ""} />
          refresh
        </button>
      </section>

      {error && (
        <div className="notice">
          Bankr API returned: {error}
        </div>
      )}

      <section className="content">
        {loading ? (
          Array.from({ length: 9 }).map((_, index) => <div className="project-card skeleton" key={index} />)
        ) : (
          visibleProjects.map((project, index) => (
            <ProjectCard project={project} rank={index + 1} key={project.id ?? project.slug} />
          ))
        )}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
