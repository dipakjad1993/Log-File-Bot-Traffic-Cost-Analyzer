# Log File & Bot Traffic cost Analyzer

**A free, open-source, client-side alternative to Botify, Loggly, Screaming Frog Log Analyzer, and other $4,000-$8,000+/month enterprise log analysis platforms.**

Upload your server access logs and get instant, in-depth insights into bot traffic, crawl budget waste, infrastructure costs, AI scraper impact, and security threats — all processed entirely in your browser. No data ever leaves your machine. No server uploads. No subscriptions. No tracking.

---

## Why This Tool Exists

In 2026, the web is flooded with automated traffic. AI scrapers like GPTBot, ClaudeBot, Bytespider, and PerplexityBot are hitting enterprise servers at unprecedented scale. They rack up cloud compute and CDN egress bills, consume crawl budget away from search engines that actually drive revenue, and generate zero ROI. Meanwhile, legacy log analysis tools charge thousands of dollars per month and still require you to upload sensitive log data to third-party servers.

**This tool solves both problems.** It runs entirely in your browser, processes logs locally, and provides the same depth of analysis that enterprise platforms offer — at zero cost.

### The Problem With Existing Tools

| Tool | Monthly Cost | Data Privacy | Depth of Analysis |
|------|-------------|--------------|-------------------|
| Botify | $4,000 - $8,000+ | Data uploaded to their servers | Good |
| Loggly (Splunk) | $2,000 - $6,000+ | Data uploaded to their servers | Good |
| Screaming Frog Log Analyzer | $259/year | Local processing | Basic |
| **This Tool** | **$0** | **100% local — never leaves your browser** | **Enterprise-grade** |

### What You Save

- **CDN Egress Waste**: $5,000 - $20,000/mo by identifying and blocking bots consuming bandwidth with zero return
- **Origin Compute Costs**: $3,000 - $15,000/mo by blocking rogue bots at the edge before they hit your servers
- **SaaS Tool Replacement**: $4,000 - $8,000/mo by eliminating Botify, Loggly, or equivalent enterprise licenses
- **Crawl Budget Optimization**: Improved organic rankings and faster indexation by reclaiming wasted crawl budget

---

## Key Features

### 1. Bot Classification (50+ Known Signatures)

The engine classifies every request against a comprehensive database of **50+ known bot signatures** and **18 real browser fingerprint patterns** from the 2026 ecosystem. Each entity is assigned a value tier:

| Tier | Score Range | Examples | Action |
|------|------------|----------|--------|
| Search Engine | +5 to +10 | Googlebot, Bingbot, YandexBot | Allow — critical for SEO |
| AI Citation | +3 to +7 | PerplexityBot, ClaudeBot, OAI-SearchBot | Rate-limit — conditional ROI |
| AI Training | -3 to 0 | CCBot, Bytespider, GPTBot | Block — zero ROI |
| SEO Tool | 0 to +2 | AhrefsBot, SEMrushBot | Monitor |
| Monitoring | 0 | Pingdom, GTmetrix | Allow |
| Social | +3 to +5 | Twitterbot, LinkedInBot | Allow |
| Suspicious | -1 to -3 | Unknown bots, headless browsers | Block |

**How classification works:**
1. The engine first checks if the User-Agent matches a **real browser fingerprint** (checking for AppleWebKit, Gecko, Blink rendering engines with OS/hardware indicators)
2. If a real browser is found AND no bot signature matches, it is classified as human
3. If a known bot signature matches first, it is classified as that bot regardless of browser patterns (preventing spoofed Googlebot claims from real browser UAs)
4. Unknown patterns are flagged for manual review

### 2. Multi-Layer Bot Verification (4 Independent Layers)

User-Agent spoofing is trivial — any scraper can claim to be Googlebot. But faking a Google IP address, TLS fingerprint, and hosting on Google's ASN simultaneously is extremely difficult. The tool validates each request through four independent verification layers:

- **Layer 1 — Reverse DNS / IP Range**: Validates the source IP against published search engine IP ranges (Google: `66.249.*`, `64.233.*`, etc.; Bing: `13.107.*`, `204.79.*`, etc.)
- **Layer 2 — TLS Fingerprint**: Checks that the TLS version matches the claimed identity (e.g., Googlebot should use TLSv1.3)
- **Layer 3 — ASN Intelligence**: Detects whether the IP is from a cloud provider (AWS, GCP, Azure, Hetzner, DigitalOcean) or residential/ISP
- **Layer 4 — Behavioral Analysis**: Identifies aggressive crawl patterns, excessive parameterized URL access, and honeypot trap triggering

### 3. Crawl Budget & Waste Heat Index

Crawl budget is the number of pages a search engine will crawl on your site within a given timeframe. When bots waste this budget on parameterized URLs, faceted navigation traps, or low-value pages, your high-quality content gets crawled less frequently, directly impacting search rankings.

**What the tool identifies:**
- Search engine crawl efficiency per crawler (2xx rate, unique URLs vs total requests)
- Parameterized URL ratio (URLs with query strings that waste crawl budget)
- Cache hit rates per crawler
- Average and P95 response times per crawler
- Crawl trap patterns: faceted navigation, pagination loops, session IDs, infinite calendar loops, internal search, API endpoints, UTM spam

### 4. Infrastructure Cost Analysis (AWS CloudFront 2026 Pricing)

Calculates the actual USD cost of serving each bot category using real cloud pricing:

| Cost Component | Rate |
|---------------|------|
| CDN Egress | $0.09/GB |
| Per-Request Processing | $0.0075 per 10,000 requests |
| SSR Compute | $0.005 per 1,000 requests |

The tool breaks down costs by bot category, showing exactly where your infrastructure budget is going and what you could save by implementing edge blocking rules.

### 5. AI Scraper Citation ROI Matrix

Not all AI bots should be blocked. Some drive referral traffic and search citations (Perplexity, ChatGPT Search). Others only train models that compete with you (Bytespider, CCBot). The matrix scores each AI bot on:

- **Request volume and bandwidth consumed**
- **Egress cost incurred**
- **ROI classification**: Positive, Conditional, or Negative
- **Recommended action**: ALLOW, RATE-LIMIT, or BLOCK

Includes a step-by-step guide for calculating full ROI by cross-referencing with Google Analytics referral data.

### 6. Automated Edge Rule Generation

Ready-to-deploy rules generated from the analysis, covering three major CDN/WAF providers:

- **Cloudflare WAF Rules**: Custom rules in Cloudflare's expression syntax
- **Fastly VCL Snippets**: VCL configuration snippets for Fastly edge compute
- **AWS WAF Rules**: WAFv2 JSON rule statements for AWS CloudFront distributions

Plus recommendations for advanced defense techniques:
- **Honeypot / Poison Pill**: Serve convincing fabricated content to confirmed scrapers
- **Tarpitting**: Serve valid responses extremely slowly (1 byte/second) to burn scraper connection pools

### 7. Performance Analysis

- **Response Time by Bot Type**: Average TTFB and P95 TTFB broken down by traffic category
- **Status Code Distribution**: 2xx, 3xx, 4xx, 5xx breakdown with visual bars
- **HTTP Method Distribution**: GET, POST, HEAD analysis with interpretation

### 8. Traffic Patterns & Velocity Detection

- **Hourly Request Distribution**: 24-hour heatmap with statistical spike detection (2+ standard deviations above mean)
- **Day-of-Week Distribution**: Weekly pattern analysis
- **Top 25 IPs by Request Volume**: Identifies high-traffic sources
- **Top 40 Most Requested URLs**: Shows which pages attract the most traffic
- **Top Referrers**: Traffic source analysis
- **Top User-Agent Strings**: Raw UA breakdown with classification

### 9. Security Threat Analysis

Automated detection of suspicious request patterns:

| Threat | Severity | Description |
|--------|----------|-------------|
| Path Traversal Attempt | CRITICAL | `../`, `..\\`, `%2e%2e` patterns |
| Sensitive File Probe | CRITICAL | `.env`, `.git`, `.htpasswd`, `.sql`, `.pem` access |
| Shell/CGI Probe | CRITICAL | `/shell`, `/cmd`, `/exec`, `cgi-bin` attempts |
| WordPress Admin Probe | HIGH | `/wp-admin`, `/wp-login`, `/wp-xmlrpc` |
| Admin Panel Probe | HIGH | `/phpmyadmin`, `/adminer`, `/admin.php` |
| Backup File Access | HIGH | `.bak`, `.old`, `.backup`, `.tar.gz` |
| Log File Access | MEDIUM | `/server-status`, `/access.log`, `/error.log` |

Plus **high-velocity IP detection** (potential DDoS or aggressive scraping) and **large payload request** identification (>10MB).

### 10. CFO / FinOps Executive Report

A boardroom-ready financial summary including:

- **Monthly Total Spend**: Infrastructure + SaaS license costs
- **Monthly Waste**: Cost of zero-ROI bot traffic
- **Monthly Savings Available**: Bot blocking + SaaS offset
- **Annual Savings Projection**: After implementing recommendations
- **Implementation Cost Estimate**: Hours x hourly rate
- **Payback Period**: Months to recover implementation cost
- **Year-One Net Savings and Annual ROI**

---

## Supported Log Formats

The tool accepts JSON-formatted log files. It auto-normalizes field names from multiple platforms:

### Input Formats

| Format | Description |
|--------|-------------|
| JSON Array | `[{"field": "value"}, ...]` |
| JSONL / NDJSON | One JSON object per line |
| `.json`, `.jsonl`, `.ndjson`, `.log` | File extensions accepted |

### Normalized Fields

The engine recognizes and normalizes field names from:

| Platform | IP Field | Timestamp Field | URI Field | Status Field |
|----------|----------|----------------|-----------|--------------|
| Cloudflare | `ClientIP` | `Timestamp` | `RequestURI` | `HttpStatus` |
| Nginx JSON | `remote_addr` | `time_local` | `request_uri` | `status` |
| Apache | `remote_addr` | `time` | `request_uri` | `status` |
| AWS ALB | `clientIP` | `@timestamp` | `requestURI` | `statusCode` |
| Varnish | `remote_addr` | `timestamp` | `request` | `status` |
| Custom | `ip`, `source_ip` | `date`, `datetime` | `url`, `path` | `http_status` |

### Additional Normalized Fields

- `user_agent` / `User-Agent` / `ua` — User-Agent string
- `bytes_sent` / `body_bytes_sent` / `size` — Response size in bytes
- `request_time` / `response_time` / `ttfb` — Response time in seconds
- `referer` / `http_referer` — Referrer URL
- `tls_protocol` / `ssl_protocol` — TLS version (TLSv1.2, TLSv1.3)
- `cache_status` / `cf_cache_status` / `x_cache` — CDN cache status

---

## Quick Start

### Option 1: Run Locally (Recommended)

```bash
# Clone the repository
git clone https://github.com/dipakjad1993/Log-File-Bot-Traffic-Cost-Analyzer.git

# Navigate to the project directory
cd Log-File-Bot-Traffic-Cost-Analyzer

# Start the server (requires Node.js)
node server.js
```

Open **http://localhost:8080** in your browser.

### Option 2: Open Directly

Simply open `index.html` in your browser. The tool works without a server (drag-and-drop upload requires a served environment for file access, but the sample data download works fine).

### Option 3: Use Any Static Server

```bash
# Python
python -m http.server 8080

# PHP
php -S localhost:8080

# Go
go run github.com/nicholasgasior/ghttp@latest -p 8080
```

---

## How to Use

### Step 1: Prepare Your Log File

Convert your server logs to JSON format. Each entry should contain at minimum:

```json
{
  "ClientIP": "66.249.66.1",
  "Timestamp": "2026-01-15T10:30:45Z",
  "RequestURI": "/products/widget-pro",
  "RequestMethod": "GET",
  "HttpStatus": 200,
  "Bytes": 24500,
  "UserAgent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "RequestTime": 0.125,
  "TLSProtocol": "TLSv1.3",
  "CacheStatus": "HIT"
}
```

### Step 2: Upload

- Click **Browse Files** or drag-and-drop your JSON log file
- Or click **Download Sample Log** to generate a 5,000-record sample dataset for testing

### Step 3: Review Analysis

The tool generates 10 detailed analysis tabs:

1. **Bot Classification** — Complete breakdown of all traffic categories with volume, bandwidth, and value scores
2. **Bot Verification** — 4-layer verification results showing verified vs suspicious bots
3. **Crawl Budget** — Search engine crawl efficiency and trap detection
4. **Cost Analysis** — USD cost breakdown by bot category with savings opportunity
5. **AI Scraper Matrix** — ROI scoring for each AI bot with blocking recommendations
6. **Edge Rules** — Ready-to-deploy Cloudflare, Fastly, and AWS WAF rules
7. **Performance** — Response time analysis and status code distribution
8. **Traffic Patterns** — Hourly/daily patterns with velocity spike detection
9. **Security** — Threat detection, high-velocity IPs, and suspicious patterns
10. **CFO / FinOps** — Executive financial summary with ROI calculations

### Step 4: Take Action

- Deploy generated edge rules to your CDN/WAF
- Share the CFO report with stakeholders
- Prioritize SEO fixes based on crawl budget analysis
- Block zero-ROI bots at the edge to reduce infrastructure costs

---

## Sample Data

The tool includes a built-in sample data generator that creates realistic 5,000-record datasets with:

- **58% Human traffic** — Real browser UAs (Chrome, Firefox, Safari, Edge) with realistic IPs
- **15% Googlebot** — From verified Google IP ranges with proper User-Agent
- **4% Bingbot** — From verified Microsoft IP ranges
- **6% GPTBot** — OpenAI's web crawler
- **3% PerplexityBot** — Perplexity AI search crawler
- **2% ClaudeBot** — Anthropic's Claude crawler
- **1.5% OAI-SearchBot** — ChatGPT Search
- **4% Bytespider** — ByteDance AI training scraper
- **2.5% CCBot** — Common Crawl AI training

The sample data includes realistic URL distributions (main pages, products, blog posts, documentation, parameterized URLs, trap URLs, and security probe URLs), status codes, cache statuses, TLS versions, and response times.

---

## Architecture

```
Log-File-Bot-Traffic-Cost-Analyzer/
├── index.html                    # Main dashboard with upload, tabs, and results
├── server.js                     # Node.js static file server (port 8080)
├── css/
│   └── style.css                 # Light theme with Inter font, modern 2026 UI
├── js/
│   └── analyzer.js               # Complete analysis engine (v4.0)
│       ├── Bot Signature DB      # 50+ known bot signatures
│       ├── Browser Fingerprints  # 18 real browser patterns
│       ├── Cloud IP Ranges       # AWS, GCP, Azure, Cloudflare, Hetzner, etc.
│       ├── Crawl Trap Patterns   # 10 URL pattern detectors
│       ├── Threat Patterns       # 7 security threat detectors
│       ├── Normalizer            # Multi-platform field normalization
│       ├── Classifier            # Bot classification engine
│       ├── Verifier              # 4-layer bot verification
│       ├── Cost Calculator       # AWS CloudFront 2026 pricing model
│       ├── Edge Rule Generator   # Cloudflare/Fastly/AWS WAF rules
│       └── 10 Tab Renderers      # Detailed HTML report generators
└── sample-data/
    └── sample-server-logs.json   # 22-record sample JSON log file
```

---

## Pricing Model

All cost calculations are based on **AWS CloudFront 2026 standard pricing**:

| Component | Rate | Description |
|-----------|------|-------------|
| CDN Egress | $0.09/GB | Bandwidth consumed across all traffic |
| Request Processing | $0.0075 / 10,000 requests | Per-request charges at CDN edge |
| SSR Compute | $0.005 / 1,000 requests | Server-side rendering for bot requests |

You can adjust these rates in the configuration to match your actual cloud provider pricing.

---

## Bot Signature Database

The engine includes signatures for **50+ known bots** across 8 categories:

### Search Engines (12 signatures)
Googlebot, AdsBot-Google, Mediapartners-Google, Google InspectionTool, FeedFetcher-Google, Bingbot, MSNbot, BingPreview, YandexBot, BaiduSpider, DuckDuckBot, Applebot, Yahoo Slurp

### AI Search / Citation (8 signatures)
PerplexityBot, ClaudeBot, OAI-SearchBot, ChatGPT-User, GPTBot, YouBot, BraveBot, Amazonbot

### AI Training Scrapers (12 signatures)
CCBot, Bytespider, Meta-ExternalAgent, Applebot-Extended, Scrapy, Python-requests, Python-urllib, Go-http-client, Java/HTTP, cURL, Wget, HeadlessChrome, PhantomJS, Puppeteer, Playwright

### SEO Tools (5 signatures)
AhrefsBot, SEMrushBot, DotBot (Moz), MJ12bot, Screaming Frog

### Social Platforms (7 signatures)
Facebookbot, facebookexternalhit, Twitterbot, LinkedInBot, Slackbot, Discordbot, Pinterestbot

### Monitoring (5 signatures)
Pingdom, UptimeRobot, GTmetrix, New Relic, Datadog

### Known IP Ranges
- **Google**: `66.249.*`, `64.233.*`, `72.14.*`, `216.239.*`, `74.125.*`, `172.217.*`, `142.250.*`, `209.85.*`, `108.177.*`, `35.190.*`, `35.191.*`, `34.*`
- **Bing**: `13.107.*`, `204.79.*`, `199.232.*`
- **Baidu**: `180.76.*`, `123.125.*`, `220.181.*`
- **Yandex**: `77.88.*`, `93.158.*`, `5.45.*`, `95.108.*`

### Cloud Provider IP Ranges
AWS, Google Cloud, Azure, Cloudflare, Hetzner, DigitalOcean, OVH, Fastly

---

## Security & Privacy

- **100% Client-Side**: All processing happens in your browser using JavaScript
- **No Server Uploads**: Log data never leaves your machine
- **No Tracking**: No analytics, no cookies, no telemetry
- **No External Dependencies**: Runs entirely offline after initial page load (Google Fonts cached automatically)
- **Open Source**: Full source code available for audit

---

## Browser Compatibility

| Browser | Minimum Version | Status |
|---------|----------------|--------|
| Chrome | 90+ | Fully Supported |
| Firefox | 90+ | Fully Supported |
| Safari | 14+ | Fully Supported |
| Edge | 90+ | Fully Supported |
| Opera | 76+ | Fully Supported |

---

## Use Cases

### E-Commerce Sites
Identify scrapers stealing product pricing and inventory data. Block AI training crawlers that replicate your product catalog. Optimize crawl budget so Google indexes new products faster.

### SaaS & Tech Companies
Measure the true cost of AI scrapers consuming your documentation and API reference pages. Generate edge rules to rate-limit or block scrapers while allowing search engine indexing.

### News & Media
Analyze which bots are consuming your content. Balance between allowing citation-driving AI search bots (Perplexity, ChatGPT Search) and blocking zero-ROI training scrapers.

### Enterprise DevOps
Replace expensive SaaS monitoring tools with a free, local alternative. Generate CFO-ready cost reports for infrastructure optimization decisions.

### SEO Professionals
Audit crawl budget efficiency across search engines. Identify crawl traps wasting bot attention. Generate recommendations for robots.txt optimization and canonical URL implementation.

---

## Contributing

Contributions are welcome. Please open an issue or pull request.

### Development Setup

```bash
git clone https://github.com/dipakjad1993/Log-File-Bot-Traffic-Cost-Analyzer.git
cd Log-File-Bot-Traffic-Cost-Analyzer
node server.js
# Open http://localhost:8080
```

### Adding New Bot Signatures

Bot signatures are defined in the `BOTS` array in `js/analyzer.js`. Each entry follows this format:

```javascript
{p:'botname', n:'Display Name', cat:'category', tier:'tier', v:5, note:'Description'}
```

### Adding New Threat Patterns

Threat patterns are defined in the `THREATS` array:

```javascript
{name:'Threat Name', regex:/pattern/i, sev:'critical'}
```

---

## Roadmap

- [ ] CSV/TSV log format support
- [ ] Compressed (.gz, .zip) file support
- [ ] Custom pricing configuration UI
- [ ] PDF export for CFO reports
- [ ] Historical comparison (upload multiple time periods)
- [ ] Custom bot signature editor
- [ ] Real-time log streaming support
- [ ] Integration with Cloudflare API for automatic rule deployment

---

## License

MIT License. See [LICENSE](LICENSE) for details.

---

## Credits

Built as a free alternative to enterprise log analysis platforms that charge $4,000-$8,000+ per month. All analysis runs locally in your browser — your log data never touches any external server.

---

## Support

- **Issues**: [GitHub Issues](https://github.com/dipakjad1993/Log-File-Bot-Traffic-Cost-Analyzer/issues)
- **Discussions**: [GitHub Discussions](https://github.com/dipakjad1993/Log-File-Bot-Traffic-Cost-Analyzer/discussions)
