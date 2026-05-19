# Basepedia API Notes

Basepedia currently reads public Bankr data directly from:

```text
https://api.bankr.bot
```

The app does not use an API key, auth header, proxy, database, or server-side cache right now. All requests are made from the browser in `src/main.jsx`.

## Runtime Endpoints

### List agent profiles

```http
GET /agent-profiles?sort=marketCap&limit=100
```

Used by `loadProjects()` to get Bankr agent/project profile data.

Response shape used:

```ts
{
  profiles: Array<{
    id: string;
    slug: string;
    projectName: string;
    description?: string;
    website?: string;
    twitterUsername?: string;
    profileImageUrl?: string;
    projectImages?: unknown[];
    tokenAddress: string;
    tokenChainId?: string;
    tokenName?: string;
    tokenSymbol?: string;
    marketCapUsd?: number;
    weeklyRevenueWeth?: string | number;
    productsCount?: number;
    createdAt?: string;
  }>;
  total: number;
  limit: number;
  offset: number;
}
```

App usage:

- Base list of projects/cards.
- Project name, description, image, website, X username.
- Token address/symbol for routing and display.
- Weekly revenue for card footer.

### List discover tokens

```http
GET /discover?sortBy=marketCapUsd&order=desc&limit=100
```

Used by `loadProjects()` to merge live token/market data into agent profiles by lowercased `tokenAddress`.

Response shape used:

```ts
{
  results: Array<{
    tokenAddress: string;
    name?: string;
    symbol?: string;
    imageUri?: string;
    marketCapUsd?: number;
    vol24h?: number;
    priceChange24h?: number;
    txCount24h?: number;
    lastPriceUsd?: number;
    lastPriceEth?: number;
    lastTradeAt?: string;
    poolId?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
  nextCursor?: string;
}
```

App usage:

- Market cap, 24h volume, 24h price change, tx count.
- Token image fallback.
- Sorting cards by market cap, volume, newest.

### Agent profile detail

```http
GET /agent-profiles/:tokenAddress
```

Used by `loadProjectDetail()` for the normal project detail UI.

Response shape used:

```ts
{
  id: string;
  slug: string;
  projectName: string;
  description?: string;
  website?: string;
  twitterUsername?: string;
  profileImageUrl?: string;
  tokenAddress: string;
  tokenChainId?: string;
  tokenName?: string;
  tokenSymbol?: string;
  marketCapUsd?: number;
  weeklyRevenueWeth?: string | number;
  teamMembers?: Array<{ name?: string; role?: string }>;
  products?: Array<{ name?: string; description?: string; url?: string }>;
  revenueSources?: unknown[];
  projectUpdates?: unknown[];
  approved?: boolean;
  createdAt?: string;
}
```

App usage:

- Detail title, copy, links, team list, products list.
- Detail image and token metadata.

### Discover token detail

```http
GET /discover/:tokenAddress
```

Used by `loadProjectDetail()` for token-level market metadata.

Response shape used:

```ts
{
  token: {
    tokenAddress: string;
    name?: string;
    symbol?: string;
    imageUri?: string;
    marketCapUsd?: number;
    vol24h?: number;
    priceChange24h?: number;
    txCount24h?: number;
    lastPriceUsd?: number;
    lastPriceEth?: number;
    lastTradeAt?: string;
    poolId?: string;
    totalSupply?: string | number;
    decimals?: number;
    websiteUrl?: string;
    tweetUrl?: string;
    deployedAt?: string;
  };
}
```

App usage:

- Detail market cap fallback.
- Last price, 24h change, pool id.
- Volume and transaction count metrics.

### Agent market cap

```http
GET /agent-profiles/:tokenAddress/market-cap
```

Used by `loadProjectDetail()` as the freshest market cap source.

Response shape used:

```ts
{
  marketCapUsd?: number;
  updatedAt?: string;
}
```

App usage:

- Overrides profile/token market cap when available.

### Agent tweets

```http
GET /agent-profiles/:tokenAddress/tweets
```

Used by `loadProjectDetail()` for the recent tweets panel.

Response shape used:

```ts
{
  tweets: Array<{
    id: string;
    text: string;
    url: string;
    createdAt?: string;
    metrics?: {
      likes?: number;
      replies?: number;
      reposts?: number;
      quotes?: number;
    };
  }>;
}
```

App usage:

- Shows the latest four tweets.
- Displays likes and replies counts.

### LLM usage

```http
GET /agent-profiles/:tokenAddress/llm-usage?days=30
```

Used by `loadProjectDetail()` for the LLM usage panel.

Response shape used:

```ts
{
  days: number;
  totals?: {
    requests?: number;
    totalTokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    successRate?: number;
    avgLatencyMs?: number;
  };
  byModel?: Array<{
    model: string;
    requests?: number;
    totalTokens?: number;
    successRate?: number;
    avgLatencyMs?: number;
  }>;
  daily?: unknown[];
}
```

App usage:

- Total tokens in 30 days.
- Top three models by token usage.

### Doppler token fees

```http
GET /public/doppler/token-fees/:tokenAddress?days=30
```

Used by `loadProjectDetail()` for fee/revenue data.

Response shape used:

```ts
{
  address: string;
  chain?: string;
  days: number;
  lifetimeEarnedWeth?: string | number;
  lifetimeBestDay?: unknown;
  dailyEarnings?: unknown[];
  lifetimeDays?: number;
  totals?: {
    earnedWeth?: string | number;
    claimableWeth?: string | number;
  };
  tokens?: Array<{
    share?: string | number;
    earnedWeth?: string | number;
    claimableWeth?: string | number;
  }>;
}
```

App usage:

- Claimable WETH.
- Lifetime fees.
- Fee share.

## Non-API External Assets

These are not runtime API calls in the app, but were used to create local public assets:

```text
public/basepedia-logo.png
```

The app uses a local 3D-style magnifying glass mark:

```text
public/basepedia-logo.png
```

Older Bankr assets are kept in `public/` only as historical local assets.

## Local Wiki Content

Token wiki pages are bundled from local Markdown content:

```text
src/content/tokens/{slug}/index.md
src/content/tokens/{slug}/meta.json
```

Current routes include:

```text
/tokens/gitlawb
/tokens/aeon
/tokens/openagentmarket
/tokens/nook
```

Recent local source files copied from:

```text
/Users/applefather/Documents/Applefather/Bankr Ecosystem/projects/gitlawb-basepedia-v2.md
/Users/applefather/Documents/Applefather/Bankr Ecosystem/projects/aeon-basepedia-v2.md
/Users/applefather/Documents/Applefather/Bankr Ecosystem/projects/openagentmarket-basepedia-v2.md
/Users/applefather/Documents/Applefather/Bankr Ecosystem/projects/nookplot.md
```

This token wiki routing does not remove the normal API-based detail UI. Legacy project routes still use the detail endpoints above.

## Error Handling

`fetchJson(url)` throws on non-2xx responses.

`fetchOptional(url)` wraps `fetchJson()` and returns `null` on failure. Detail pages use this for optional panels so one failed endpoint does not break the whole detail page.

List loading uses hard failures for:

```text
/agent-profiles?sort=marketCap&limit=100
/discover?sortBy=marketCapUsd&order=desc&limit=100
```

If either list endpoint fails, the app shows a Bankr API error notice.
