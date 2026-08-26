# Open-Source Log File & Bot Traffic Analyzer

A fast, privacy-focused, 100% client-side web utility for parsing server access logs, identifying bot traffic patterns, analyzing crawl budget distribution, and estimating infrastructure egress overhead.

🚀 **Live Demo:** [log-file-bot-traffic-cost-analyzer.onrender.com](https://log-file-bot-traffic-cost-analyzer.onrender.com)

---

## Overview

Modern web servers face heavy automated traffic from traditional search engine crawlers, SEO scrapers, and AI training bots. Understanding how this traffic impacts your site performance and crawl efficiency usually requires complex server-side pipelines or costly analytics subscriptions.

This open-source tool allows Technical SEOs, developers, and sysadmins to quickly drop JSON/NDJSON log files into their browser to audit bot behaviors, evaluate user-agent distributions, and generate quick edge-filtering recommendations—without uploading sensitive log data to any third-party server.

---

## Key Capabilities

* **User-Agent & Bot Classification:** Matches request streams against 50+ known search engine, AI scraper (GPTBot, ClaudeBot, Bytespider), and monitoring tool signatures.
* **Crawl Budget & Trap Diagnostic:** Identifies parameterized query traps, pagination loops, and low-value directory paths consuming crawler attention.
* **Estimated Egress Cost Calculation:** Maps traffic bandwidth against standard CloudFront/CDN pricing models to calculate approximate infrastructure impact by traffic category.
* **AI Scraper Impact Matrix:** Helps categorize incoming bot traffic to determine whether to allow, rate-limit, or block specific scrapers at the edge.
* **CDN Edge Rule Generator:** Automatically outputs ready-to-copy syntax rules for Cloudflare WAF, Fastly VCL, and AWS WAF based on identified suspicious user-agents.
* **Security & Probe Detection:** Flags automated path traversal attempts (`../`), sensitive file probes (`.env`, `.git`), and vulnerability scanning patterns.

---

## Data Privacy & Architecture

* **100% Client-Side Processing:** Log data is parsed locally in-browser using client-side JavaScript. No access logs leave your machine.
* **Multi-Format Normalization:** Accepts standard JSON, JSONL, and NDJSON logs from Cloudflare, Nginx, Apache, AWS ALB, and Varnish.

---

## Quick Start (Local Setup)

```bash
# Clone the repository
git clone https://github.com/dipakjad1993/Log-File-Bot-Traffic-Cost-Analyzer.git

# Navigate to directory
cd Log-File-Bot-Traffic-Cost-Analyzer

# Start local static server (Node.js)
node server.js
```

Open **http://localhost:8080** in your browser.

---

## Supported Log Formats

The tool accepts JSON-formatted log files and auto-normalizes field names from multiple platforms:

| Platform | IP Field | Timestamp Field | URI Field | Status Field |
|----------|----------|----------------|-----------|--------------|
| Cloudflare | `ClientIP` | `Timestamp` | `RequestURI` | `HttpStatus` |
| Nginx JSON | `remote_addr` | `time_local` | `request_uri` | `status` |
| Apache | `remote_addr` | `time` | `request_uri` | `status` |
| AWS ALB | `clientIP` | `@timestamp` | `requestURI` | `statusCode` |
| Varnish | `remote_addr` | `timestamp` | `request` | `status` |

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

## Security & Privacy

* **100% Client-Side:** All processing happens in your browser using JavaScript.
* **No Server Uploads:** Log data never leaves your machine.
* **No Tracking:** No analytics, no cookies, no telemetry.
* **No External Dependencies:** Runs entirely offline after initial page load.
* **Open Source:** Full source code available for audit.

---

## Contributing

Contributions are welcome. Please open an issue or pull request.

---

## License

MIT License. See [LICENSE](LICENSE) for details.
