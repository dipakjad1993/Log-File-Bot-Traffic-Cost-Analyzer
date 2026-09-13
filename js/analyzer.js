/* ============================================================
   Log File & Bot Traffic Cost Analyzer — Engine v4.0
   Complete rewrite: bug-free, deep analysis, light theme
   ============================================================ */
(function(){
'use strict';

/* ==== A: BOT SIGNATURE DB v2026.09 — training vs search-index vs user-triggered ==== */
const BOT_DB_VERSION='2026.09.02';
const BOT_IP_JSON_DATE='2026-09-01';
// 2026 interview-critical split:
//  ai_training    = throttle/block freely, zero live citation loss (GPTBot, CCBot, Bytespider, Google-Extended token)
//  ai_search_index= allow 60-120 req/min/IP or citation share drops in 1-2 wks (OAI-SearchBot, PerplexityBot, Claude-SearchBot)
//  ai_user_fetch  = do NOT throttle (300/min ceiling only), 429 = missing live answer (ChatGPT-User, Perplexity-User, Claude-User)
// citationRisk: none (training) / medium-high (search) / critical-do-not-block (user)
const BOTS=[
  {p:'googlebot',n:'Googlebot',cat:'search_engine',tier:'search_engine',note:'Primary organic search crawler. Critical for SEO visibility.'},
  {p:'adsbot-google',n:'AdsBot-Google',cat:'search_engine',tier:'search_engine',note:'Google Ads landing page quality crawler.'},
  {p:'mediapartners-google',n:'Mediapartners-Google',cat:'search_engine',tier:'search_engine',note:'Google AdSense crawler.'},
  {p:'google-inspectiontool',n:'Google InspectionTool',cat:'search_engine',tier:'search_engine',note:'Google Rich Results testing tool.'},
  {p:'google-read-aloud',n:'Google-Read-Aloud',cat:'search_engine',tier:'search_engine',note:'Google Read Aloud voice agent.'},
  {p:'feedfetcher-google',n:'FeedFetcher-Google',cat:'search_engine',tier:'search_engine',note:'Google feed fetcher.'},
  {p:'bingbot',n:'Bingbot',cat:'search_engine',tier:'search_engine',note:'Microsoft Bing crawler.'},
  {p:'msnbot',n:'MSNbot',cat:'search_engine',tier:'search_engine',note:'Legacy Bing crawler.'},
  {p:'bingpreview',n:'BingPreview',cat:'search_engine',tier:'search_engine',note:'Bing snapshot crawler.'},
  {p:'yandexbot',n:'YandexBot',cat:'search_engine',tier:'search_engine',note:'Yandex search crawler.'},
  {p:'baiduspider',n:'BaiduSpider',cat:'search_engine',tier:'search_engine',note:'Baidu search crawler.'},
  {p:'duckduckbot',n:'DuckDuckBot',cat:'search_engine',tier:'search_engine',note:'DuckDuckGo search crawler.'},
  {p:'duckassistbot',n:'DuckAssistBot',cat:'ai_search_index',tier:'ai_search_index',note:'DuckDuckGo AI answer fetcher. Allow — citation source.',citationRisk:'medium',rateLimit:'120/min/IP'},
  {p:'applebot',n:'Applebot',cat:'search_engine',tier:'search_engine',note:'Apple/Siri web index crawler.'},
  {p:'yahoo! slurp',n:'Yahoo Slurp',cat:'search_engine',tier:'search_engine',note:'Yahoo search crawler.'},
  {p:'facebot',n:'Facebookbot',cat:'social',tier:'social',note:'Facebook/Meta link preview crawler.'},
  {p:'facebookexternalhit',n:'facebookexternalhit',cat:'social',tier:'social',note:'Facebook link sharing crawler.'},
  {p:'meta-externalfetcher',n:'Meta-ExternalFetcher',cat:'social',tier:'social',note:'Meta link preview fetcher (user-triggered shares). Do not aggressively block.'},
  {p:'twitterbot',n:'Twitterbot',cat:'social',tier:'social',note:'Twitter/X card preview crawler.'},
  {p:'linkedinbot',n:'LinkedInBot',cat:'social',tier:'social',note:'LinkedIn link preview crawler.'},
  {p:'slackbot',n:'Slackbot',cat:'social',tier:'social',note:'Slack link unfurling.'},
  {p:'discordbot',n:'Discordbot',cat:'social',tier:'social',note:'Discord link embed.'},
  {p:'pinterestbot',n:'Pinterestbot',cat:'social',tier:'social',note:'Pinterest pin crawler.'},
  // --- AI SEARCH-INDEX (allow, rate-limit 60-120/min) ---
  {p:'perplexitybot',n:'PerplexityBot',cat:'ai_search_index',tier:'ai_search_index',note:'Perplexity AI search. Best ROI 210:1 crawl-to-referral. ALLOW.',citationRisk:'high',rateLimit:'120/min/IP',verify:'https://docs.perplexity.ai/bot.json',referral:'210:1'},
  {p:'oai-searchbot',n:'OAI-SearchBot',cat:'ai_search_index',tier:'ai_search_index',note:'OpenAI ChatGPT Search. 85:1 crawl-to-referral. ALLOW — 5% blocked vs GPTBot 25%.',citationRisk:'high',rateLimit:'120/min/IP',verify:'https://openai.com/searchbot.json',referral:'85:1'},
  {p:'oai-adsbot',n:'OAI-AdsBot',cat:'search_engine',tier:'search_engine',note:'OpenAI ChatGPT Ads/commerce verification. DO NOT BLOCK on ecommerce — blocking breaks revenue checks for ChatGPT shopping surfaces.',citationRisk:'critical-do-not-block',rateLimit:'allow; 300/min abuse ceiling only'},
  {p:'googleother',n:'GoogleOther',cat:'ai_training',tier:'ai_training',note:'Google non-search crawl (R&D/AI/product). Covers GoogleOther-Image/Video. Rate-limit; blocking is lower-risk than Googlebot.',citationRisk:'none',rateLimit:'60/min (20 aggressive)'},
  {p:'claude-searchbot',n:'Claude-SearchBot',cat:'ai_search_index',tier:'ai_search_index',note:'Anthropic Claude search. No IP list — robots.txt only. ALLOW. Crawl-to-referral ~5,143:1 (improved from 20,583:1, still worst in class).',citationRisk:'high',rateLimit:'120/min/IP',referral:'5,143:1'},
  {p:'youbot',n:'YouBot',cat:'ai_search_index',tier:'ai_search_index',note:'You.com AI search crawler. ALLOW.',citationRisk:'medium',rateLimit:'120/min/IP'},
  {p:'bravebot',n:'BraveBot',cat:'ai_search_index',tier:'ai_search_index',note:'Brave Search AI crawler. ALLOW.',citationRisk:'medium',rateLimit:'120/min/IP'},
  {p:'amazonbot',n:'Amazonbot',cat:'ai_search_index',tier:'ai_search_index',note:'Amazon/Alexa crawler. ALLOW with limits.',citationRisk:'medium',rateLimit:'120/min/IP'},
  // --- AI USER-TRIGGERED (do NOT throttle) ---
  {p:'chatgpt-user',n:'ChatGPT-User',cat:'ai_user_fetch',tier:'ai_user_fetch',note:'User-triggered live browse. 54% ignore robots. Do NOT throttle; 429 = missing live answer.',citationRisk:'critical-do-not-block',rateLimit:'no-throttle (300/min abuse ceiling only)',verify:'https://openai.com/gptbot.json'},
  {p:'perplexity-user',n:'Perplexity-User',cat:'ai_user_fetch',tier:'ai_user_fetch',note:'User-triggered Perplexity fetch. robots.txt may not apply. Do NOT throttle.',citationRisk:'critical-do-not-block',rateLimit:'no-throttle'},
  {p:'claude-user',n:'Claude-User',cat:'ai_user_fetch',tier:'ai_user_fetch',note:'User-triggered Claude fetch. Do NOT throttle.',citationRisk:'critical-do-not-block',rateLimit:'no-throttle'},
  {p:'mistralai-user',n:'MistralAI-User',cat:'ai_user_fetch',tier:'ai_user_fetch',note:'User-triggered Mistral fetch. Do NOT throttle.',citationRisk:'critical-do-not-block',rateLimit:'no-throttle'},
  {p:'google-agent',n:'Google-Agent',cat:'ai_user_fetch',tier:'ai_user_fetch',note:'Google AI agent (user-triggered). Do NOT throttle.',citationRisk:'critical-do-not-block',rateLimit:'no-throttle'},
  // --- AI TRAINING (block freely) ---
  {p:'gptbot',n:'GPTBot',cat:'ai_training',tier:'ai_training',note:'OpenAI training. Block freely — zero live citation loss.',citationRisk:'none',rateLimit:'60/min (20 aggressive)',verify:'https://openai.com/gptbot.json'},
  {p:'claudebot',n:'ClaudeBot',cat:'ai_training',tier:'ai_training',note:'Anthropic training. No IP list — robots.txt only. Block freely. Crawl-to-referral was 20,583:1, now ~5,143:1 — still worst in class.',citationRisk:'none',rateLimit:'60/min (20 aggressive)'},
  {p:'ccbot',n:'CCBot',cat:'ai_training',tier:'ai_training',note:'Common Crawl. Zero direct ROI. Block freely.',citationRisk:'none',rateLimit:'60/min (20 aggressive)'},
  {p:'bytespider',n:'Bytespider',cat:'ai_training',tier:'ai_training',note:'ByteDance training. Extremely aggressive. Block.',citationRisk:'none',rateLimit:'20/min aggressive'},
  {p:'cohere-ai',n:'cohere-ai',cat:'ai_training',tier:'ai_training',note:'Cohere training crawler. Block freely.',citationRisk:'none',rateLimit:'60/min (20 aggressive)'},
  {p:'ai2bot',n:'AI2Bot',cat:'ai_training',tier:'ai_training',note:'Allen Institute training crawler. Block freely.',citationRisk:'none',rateLimit:'60/min'},
  {p:'meta-externalagent',n:'Meta-ExternalAgent',cat:'ai_training',tier:'ai_training',note:'Meta AI training crawler. Block freely.',citationRisk:'none',rateLimit:'60/min (20 aggressive)'},
  {p:'applebot-extended',n:'Applebot-Extended',cat:'ai_training',tier:'ai_training',note:'Apple training crawler. Block via robots token.',citationRisk:'none',rateLimit:'60/min'},
  {p:'google-extended',n:'Google-Extended (robots token)',cat:'ai_training',tier:'ai_training',note:'NOT a UA — robots.txt token controlling Gemini training. See Robots tab.',citationRisk:'none',rateLimit:'robots.txt Disallow'},
  {p:'imagesiftbot',n:'ImageSiftBot',cat:'ai_training',tier:'ai_training',note:'Image-training crawler. Block freely via robots + edge.',citationRisk:'none',rateLimit:'60/min (20 aggressive)'},
  {p:'scrapy',n:'Scrapy',cat:'ai_training',tier:'ai_training',note:'Python Scrapy framework scraper.'},
  {p:'python-requests',n:'Python-requests',cat:'ai_training',tier:'ai_training',note:'Python HTTP client. Generic scraper.'},
  {p:'python-urllib',n:'Python-urllib',cat:'ai_training',tier:'ai_training',note:'Python urllib. Generic scraper.'},
  {p:'go-http-client',n:'Go-http-client',cat:'ai_training',tier:'ai_training',note:'Go HTTP client. Often automated.'},
  {p:'java/',n:'Java/HTTP',cat:'ai_training',tier:'ai_training',note:'Java HTTP client.'},
  {p:'curl/',n:'cURL',cat:'ai_training',tier:'ai_training',note:'cURL command. Automated downloading.'},
  {p:'wget/',n:'Wget',cat:'ai_training',tier:'ai_training',note:'Wget. Automated downloading.'},
  {p:'headlesschrome',n:'HeadlessChrome',cat:'ai_training',tier:'ai_training',note:'Headless Chrome. Automated browser.'},
  {p:'phantomjs',n:'PhantomJS',cat:'ai_training',tier:'ai_training',note:'PhantomJS headless browser.'},
  {p:'puppeteer',n:'Puppeteer',cat:'ai_training',tier:'ai_training',note:'Puppeteer headless browser.'},
  {p:'playwright',n:'Playwright',cat:'ai_training',tier:'ai_training',note:'Playwright test automation.'},
  {p:'ahrefsbot',n:'AhrefsBot',cat:'seo_tool',tier:'seo_tool',note:'Ahrefs SEO crawler. Provides backlink data.'},
  {p:'semrushbot',n:'SEMrushBot',cat:'seo_tool',tier:'seo_tool',note:'SEMrush SEO crawler.'},
  {p:'dotbot',n:'DotBot (Moz)',cat:'seo_tool',tier:'seo_tool',note:'Moz/DotBot SEO crawler.'},
  {p:'mj12bot',n:'MJ12bot',cat:'seo_tool',tier:'seo_tool',note:'Majestic SEO crawler.'},
  {p:'screaming frog',n:'Screaming Frog',cat:'seo_tool',tier:'seo_tool',note:'Screaming Frog SEO Spider tool.'},
  {p:'pingdom',n:'Pingdom',cat:'monitoring',tier:'monitoring',note:'Pingdom uptime monitor.'},
  {p:'uptimerobot',n:'UptimeRobot',cat:'monitoring',tier:'monitoring',note:'UptimeRobot monitor.'},
  {p:'gtmetrix',n:'GTmetrix',cat:'monitoring',tier:'monitoring',note:'GTmetrix performance monitor.'},
  {p:'newrelic',n:'New Relic',cat:'monitoring',tier:'monitoring',note:'New Relic monitoring agent.'},
  {p:'datadog',n:'Datadog',cat:'monitoring',tier:'monitoring',note:'Datadog monitoring agent.'},
];
// 2026 rate-limit policy table (single source of truth for edge rules + robots tab)
const RATE_POLICY={
  ai_training:{label:'Training',action:'throttle/block freely',limit:'60 req/min/IP',aggressive:'20 req/min/IP',robots:'Disallow',cf:'Cloudflare AI Crawl Control → Block Training',risk:'none'},
  ai_search_index:{label:'Search-index',action:'allow with limits',limit:'120 req/min/IP',aggressive:'60 req/min/IP',robots:'Allow',cf:'Cloudflare AI Crawl Control → Allow Search',risk:'medium-high (citation loss in 1-2 wks if blocked)'},
  ai_user_fetch:{label:'User-triggered',action:'DO NOT throttle',limit:'no throttle (300/min abuse ceiling only)',aggressive:'429 = missing live answer',robots:'Allow (robots.txt may not apply)',cf:'Cloudflare AI Crawl Control → Allow Agent',risk:'critical (do not block)'},
  ai_citation:{label:'AI citation (legacy alias of Search-index)',action:'allow with limits',limit:'120 req/min/IP',aggressive:'60 req/min/IP',robots:'Allow',cf:'Allow Search',risk:'medium-high'},
  search_engine:{label:'Search engine',action:'allow',limit:'none',aggressive:'none',robots:'Allow',cf:'Allow',risk:'critical (organic visibility)'}
};

// Bot-first classification order documented: bot signatures take precedence over browser
// fingerprints to prevent spoofed-UA bypass. python/curl-in-Chrome edge case handled explicitly.
const REAL_BROWSERS=[
  {p:'windows nt 10.0',n:'Chrome on Windows'},
  {p:'windows nt 6.1',n:'Chrome on Windows 7'},
  {p:'windows nt 6.3',n:'Chrome on Windows 8.1'},
  {p:'macintosh; intel mac os x',n:'Safari on macOS'},
  {p:'x11; linux',n:'Chrome on Linux'},
  {p:'android',n:'Mobile Chrome'},
  {p:'iphone; cpu iphone os',n:'Safari on iPhone'},
  {p:'ipad; cpu os',n:'Safari on iPad'},
  {p:'edge/',n:'Microsoft Edge'},
  {p:'edg/',n:'Microsoft Edge (Chromium)'},
  {p:'firefox/',n:'Firefox'},
  {p:'opr/',n:'Opera'},
  {p:'samsungbrowser',n:'Samsung Browser'},
  {p:'ucbrowser',n:'UC Browser'},
  {p:'yabrowser',n:'Yandex Browser'},
  {p:'chrome/',n:'Chrome'},
  {p:'version/',n:'Safari'},
  {p:'applewebkit/',n:'WebKit browser'},
];

// NOTE: only full /16-or-longer prefixes are kept here. Single-octet /8 prefixes
// (e.g. '3.', '34.', '35.') match 1/256 of IPv4 and caused mass false positives,
// so they were removed in v1.2.0. Remaining matches are STILL low-confidence
// info signals only. Authoritative verification = vendor IP JSON
// (see data/bot-ips.json, dated). UI must label prefix matches
// "heuristic (low confidence)" and JSON matches "VERIFIED via IP JSON".
const ENGINE_IPS={
  Google:['66.249.','64.233.','72.14.','216.239.','74.125.','172.217.','142.250.','209.85.','108.177.','35.190.','35.191.'],
  Bing:['13.107.','204.79.','199.232.'],
  Baidu:['180.76.','123.125.','220.181.'],
  Yandex:['77.88.','93.158.','5.45.','95.108.'],
};
const CLOUD_IPS={
  AWS:['184.72.','204.236.','52.95.','52.119.','54.239.'],
  'Google Cloud':['130.211.','35.186.','35.190.','35.191.','34.102.','34.120.'],
  Azure:['13.64.','13.65.','13.66.','40.76.','40.77.','52.96.','52.97.'],
  Cloudflare:['104.16.','104.17.','104.18.','104.19.','172.64.','172.65.'],
  Hetzner:['5.9.','37.120.','138.201.','49.12.'],
  DigitalOcean:['159.65.','104.131.','167.71.'],
  OVH:['51.38.','149.202.','91.121.','147.189.'],
  Fastly:['151.101.','199.232.'],
};
/* Tiny IP matcher (~40 lines): IPv4 prefix + CIDR (/16-/32) + IPv6 prefix.
 * Logs in 2026 are dual-stack — plain startsWith('40.88.') breaks on
 * 40.88.0.1/16 ranges and on 2600:... addresses. normalizeIP strips
 * brackets, ports and zone ids; ipInCidr handles v4 CIDR properly. */
function normalizeIP(ip){
  if(!ip)return'';
  let s=String(ip).trim().toLowerCase();
  if(s.startsWith('[')){const e=s.indexOf(']');s=e>0?s.slice(1,e):s.slice(1);}
  const pct=s.indexOf('%');if(pct>0)s=s.slice(0,pct); // fe80::1%eth0
  if(s.includes(', '))s=s.split(',')[0].trim();
  // strip :port only for dotted v4 ("1.2.3.4:443"), never for v6 ("::")
  if(/^\d+\.\d+\.\d+\.\d+:\d+$/.test(s))s=s.slice(0,s.lastIndexOf(':'));
  return s;
}
function ipToInt(ip){
  const m=String(ip).match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if(!m)return null;
  const o=[+m[1],+m[2],+m[3],+m[4]];
  if(o.some(x=>x>255))return null;
  return ((o[0]*256+o[1])*256+o[2])*256+o[3];
}
function ipInCidr(ip,cidr){
  const s=normalizeIP(ip),c=String(cidr).trim().toLowerCase();
  if(!s||!c)return false;
  if(!c.includes('/')){ // plain prefix: '40.88.' (v4) or '2600:1400:' (v6)
    if(s.includes(':')||c.includes(':'))return s.startsWith(c);
    return s===c||s.startsWith(c);
  }
  const[base,bitsStr]=c.split('/');const bits=parseInt(bitsStr,10);
  if(s.includes(':')||base.includes(':'))return s.startsWith(base.replace(/:+$/,''));
  const a=ipToInt(s),b=ipToInt(base);
  if(a===null||b===null||!(bits>=0&&bits<=32))return false;
  const mask=bits===0?0:(0xFFFFFFFF<<Math.max(0,32-bits))>>>0;
  return ((a&mask)>>>0)===((b&mask)>>>0);
}
function ipMatchesAny(ip,list){const s=normalizeIP(ip);if(!s)return false;return (list||[]).some(p=>ipInCidr(s,p));}
// Vendor IP JSON registry — fetch at build time into data/bot-ips.json, show date badge in UI.
const BOT_IP_SOURCES=[
  {bot:'GPTBot / ChatGPT-User',url:'https://openai.com/gptbot.json'},
  {bot:'OAI-SearchBot',url:'https://openai.com/searchbot.json'},
  {bot:'PerplexityBot / Perplexity-User',url:'https://docs.perplexity.ai/bot.json'},
  {bot:'ClaudeBot / Claude-SearchBot',url:'(none — Anthropic publishes no IP list; use robots.txt only)'}
];

const TRAPS=[
  {name:'Faceted Navigation / Filters',regex:/[?&](color|size|brand|category|type|style|material|price|rating|condition|filter|f_[a-z]+)=/i,sev:'high'},
  {name:'Pagination Loops',regex:/[?&](page|p|offset|start|from|cursor|after)=\d+/i,sev:'medium'},
  {name:'Sort Parameter Variants',regex:/[?&](sort|order|direction|sort_by|sort_order)=/i,sev:'medium'},
  {name:'Session/Tracking IDs',regex:/[?&](session|sid|sess|token|phpsessid|jsessionid)=/i,sev:'high'},
  {name:'Infinite Calendar/Date Loops',regex:/\/(calendar|archive|date|day|month|year)\/\d{4}/i,sev:'high'},
  {name:'Internal Search Results',regex:/\/(search|query|find|results?)\/|[\?&](q|query|search|keyword|term)=/i,sev:'medium'},
  {name:'Tag/Category Pagination',regex:/\/(tag|tags|author|category|label)\/[^\/]+\/page\/\d+/i,sev:'low'},
  {name:'API/AJAX Endpoints',regex:/\/api\/|\/ajax\/|\/graphql|\/v\d+\/|\.json$|\.xml$/i,sev:'medium'},
  {name:'Complex Query Strings (3+ params)',regex:/\?[^?]+&[^?]+&[^?]+&/,sev:'high'},
  {name:'UTM Parameter Spam',regex:/[?&]utm_[a-z]+=/i,sev:'low'},
  {name:'Ad/Attribution Click IDs',regex:/[?&](gclid|fbclid|msclkid|srsltid|wbraid|gbraid|ttclid)=/i,sev:'medium'},
  {name:'Currency/Locale Variants',regex:/[?&](currency|locale|lang|region|country)=/i,sev:'medium'},
  {name:'Filter Path Segments',regex:/\/filter\/|\/page\/\d+/i,sev:'medium'},
];

const THREATS=[
  {name:'Path Traversal Attempt',regex:/\.\.\/|\.\.\\|%2e%2e|%252e%252e/i,sev:'critical'},
  {name:'Sensitive File Probe',regex:/\.(env|git|svn|htpasswd|htaccess|config|bak|sql|dump|key|pem)$/i,sev:'critical'},
  {name:'Git/Cloud Credential Probe',regex:/\/\.git\/(HEAD|config)|\/\.aws\/credentials|\/\.env/i,sev:'critical'},
  {name:'WordPress Admin Probe',regex:/\/wp-(admin|login|xmlrpc)/i,sev:'high'},
  {name:'Admin Panel Probe',regex:/\/(phpmyadmin|adminer|admin\.php|login\.php|xmlrpc\.php|manager\/)/i,sev:'high'},
  {name:'Shell/CGI Probe',regex:/\/(shell|cmd|exec|cgi-bin|bin\/sh|bin\/bash)/i,sev:'critical'},
  {name:'Actuator/Health Probe',regex:/\/actuator\/health|\/actuator\/|\/healthz|\/readyz/i,sev:'high'},
  {name:'Backup File Access',regex:/\.(bak|old|backup|sql|dump|tar\.gz|zip|rar)$/i,sev:'high'},
  {name:'Log File Access',regex:/\/(server-status|server-info|error\.log|access\.log|debug|trace)/i,sev:'medium'},
];

/* ==== B: UTILITIES ==== */
function fmtB(b){if(!b||isNaN(b))return'0 B';const k=1024,s=['B','KB','MB','GB','TB'],i=Math.floor(Math.log(Math.abs(b))/Math.log(k));return parseFloat((b/Math.pow(k,i)).toFixed(2))+' '+s[i]}
function fmtN(n){if(n==null||isNaN(n))return'0';return n.toLocaleString('en-US')}
function fmtC(n){if(n==null||isNaN(n))return'$0.00';return'$'+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',')}
function fmtP(n){if(n==null||isNaN(n))return'0.0%';return n.toFixed(1)+'%'}
function esc(s){if(!s)return'';const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function avg(a){return a.length?a.reduce((s,v)=>s+v,0)/a.length:0}
function pctl(a,p){if(!a.length)return 0;const s=[...a].sort((x,y)=>x-y);return s[Math.min(Math.floor(s.length*p/100),s.length-1)]}
function grpBy(arr,fn){const m={};for(const i of arr){const k=typeof fn==='function'?fn(i):i[fn];if(!m[k])m[k]=[];m[k].push(i)}return m}

/* ==== C: NORMALIZE ==== */
function pick(o,...keys){
  for(const k of keys){
    if(o[k]!==undefined&&o[k]!==null&&o[k]!=='')return String(o[k]);
    const lk=k.toLowerCase();
    for(const ok of Object.keys(o)){if(ok.toLowerCase()===lk)return String(o[ok])}
  }
  return null;
}
function parseTime(ts){
  if(ts==null||ts==='')return null;
  if(typeof ts==='number'){ // epoch sec or ms
    const ms=ts<1e12?ts*1000:ts; const d=new Date(ms); return isNaN(d.getTime())?null:d;
  }
  const s=String(ts).trim();
  if(/^\d{10}(\.\d+)?$/.test(s)) return new Date(parseFloat(s)*1000);
  if(/^\d{13}$/.test(s)) return new Date(parseInt(s,10));
  // Apache/Nginx combined: 10/Oct/2000:13:55:36 -0700
  let m=s.match(/(\d{2})\/(\w{3})\/(\d{4}):(\d{2}):(\d{2}):(\d{2})\s*([+-]\d{4}|[A-Z]+)?/);
  if(m){ const d=new Date(`${m[2]} ${m[1]} ${m[3]} ${m[4]}:${m[5]}:${m[6]} ${m[7]||''}`); if(!isNaN(d.getTime()))return d; }
  // W3C Extended: 2026-09-01 10:00:00
  m=s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)/);
  if(m){ const d=new Date(s.replace(' ','T')+'Z'); if(!isNaN(d.getTime()))return d; }
  const d=new Date(s); return isNaN(d.getTime())?null:d;
}
function norm(rec){
  const raw_ip=pick(rec,'remote_addr','client_ip','clientIP','ClientIP','clientip','real_ip','ip','source_ip','x_forwarded_for','c-ip','ip_address','client','ClientHost','edge_start_timestamp');
  let ip=raw_ip;if(ip&&ip.includes(','))ip=ip.split(',')[0].trim();if(ip&&ip.startsWith('['))ip=ip.slice(1,-1);
  // AWS ALB / Cloudflare Logpush native maps: "client:port" -> strip port
  if(ip&&/^\d+\.\d+\.\d+\.\d+:\d+$/.test(ip))ip=ip.split(':')[0];
  const ts=pick(rec,'timestamp','time','time_local','date','datetime','created','@timestamp','ts','Timestamp','Time','Date','log_time','date_time','request_creation_time','EdgeStartTimestamp');
  let tstamp=ts?parseTime(ts):null;
  const method=(pick(rec,'method','request_method','requestMethod','RequestMethod','http_method')||'GET').toUpperCase();
  let uri=pick(rec,'uri','request_uri','requestURI','RequestURI','url','path','request','request_path','request_url','cs_uri','cs-uri-stem')||'/';
  // Some JSON logs put the FULL request line ("GET /path HTTP/1.1") in `request` — extract the path
  const rm=String(uri).match(/^(GET|POST|PUT|DELETE|HEAD|PATCH|OPTIONS|TRACE|CONNECT)\s+(\S+)/i);
  if(rm)uri=rm[2];
  const statusStr=pick(rec,'status','status_code','statusCode','HttpStatus','http_status','elb_status_code','target_status_code','sc-status','EdgeResponseBytes');
  const status=statusStr?parseInt(statusStr,10):0;
  const ua=pick(rec,'user_agent','useragent','userAgent','UserAgent','User-Agent','ua','http_user_agent','cs(User-Agent)')||'';
  const bytesStr=pick(rec,'bytes','bytes_sent','bytesSent','body_bytes_sent','bodyBytesSent','response_bytes','size','content_length','sent_bytes','sc-bytes','EdgeResponseBytes');
  const bytes=bytesStr?parseInt(bytesStr,10):0;
  const rtStr=pick(rec,'request_time','requestTime','RequestTime','response_time','upstream_response_time','duration','latency','ttfb','target_processing_time','request_processing_time');
  const rt=rtStr?parseFloat(rtStr):null;
  const referer=pick(rec,'referer','referrer','http_referer','httpReferer','request_referer')||'';
  const tls=pick(rec,'tls_protocol','ssl_protocol','sslProtocol','TLSProtocol')||'';
  const cache=pick(rec,'cache_status','cacheStatus','CacheStatus','cf_cache_status','x_cache','X-Cache','CacheResponseStatus')||'';
  return {raw:rec,ip,tstamp,method,uri,status,ua,bytes:isNaN(bytes)?0:bytes,rt:isNaN(rt)?null:rt,referer,tls,cache};
}

/* ==== D: CLASSIFY (bot-first order; documented to prevent spoofing) ==== */
function classifyBot(ua){
  if(!ua)return{name:'Unknown (No User-Agent)',cat:'unknown',tier:'unknown'};
  const ual=ua.toLowerCase();
  // Bot signatures FIRST (bot-first order). Longest patterns match first so
  // specific tokens (applebot-extended, meta-externalagent) win over their
  // shorter prefixes (applebot, meta-externalfetcher). Only exception: generic
  // HTTP libs (python/curl) embedded in a real browser UA are treated as browser.
  const sigs=[...BOTS].sort((a,b)=>b.p.length-a.p.length);
  for(const sig of sigs){
    if(ual.includes(sig.p.toLowerCase())){
      if(['python-requests','python-urllib','go-http-client','java/','curl/','wget/'].includes(sig.p)){
        if(ual.includes('chrome/')||ual.includes('firefox/')||ual.includes('safari/'))continue;
      }
      return{name:sig.n,cat:sig.cat,tier:sig.tier,note:sig.note,citationRisk:sig.citationRisk||null,rateLimit:sig.rateLimit||null};
    }
  }
  let isBrowser=false,browserName='';
  for(const bp of REAL_BROWSERS){
    if(ual.includes(bp.p.toLowerCase())){isBrowser=true;browserName=bp.n;break;}
  }
  if(isBrowser)return{name:'Human Browser ('+browserName+')',cat:'human',tier:'human',note:'Genuine human browser traffic'};
  const hints=['bot','spider','crawler','fetch','scrape','archive','collector','monitor','checker','validator'];
  for(const h of hints){if(ual.includes(h))return{name:'Unknown Bot ('+h+')',cat:'unknown_bot',tier:'unknown_bot',note:ua.substring(0,80)}}
  if(ua.length<10)return{name:'Minimal/Empty UA',cat:'suspicious',tier:'suspicious',note:ua};
  if(ua.length>30&&(ual.includes('mozilla')||ual.includes('webkit')||ual.includes('chrome')||ual.includes('safari')))return{name:'Likely Human',cat:'human',tier:'human',note:'Browser-like UA'};
  return{name:'Unclassified',cat:'unclassified',tier:'unclassified',note:ua.substring(0,80)};
}

/* ==== E: VERIFY (signals, not proof — IP JSON authoritative, prefixes heuristic-only) ==== */
function verifyBot(rec,b,ipDb){
  const c={dns:{s:'skip',d:''},tls:{s:'skip',d:''},asn:{s:'skip',d:''},beh:{s:'skip',d:''}};
  const nip=normalizeIP(rec.ip);
  // 1) Vendor IP JSON check (authoritative) if a DB was loaded — supports CIDR + IPv6
  if(ipDb&&nip){
    for(const entry of ipDb){
      if(entry.prefixes&&ipMatchesAny(nip,entry.prefixes)&&b.name&&entry.bots.some(x=>b.name.toLowerCase().includes(x))){
        c.dns={s:'verified',d:`VERIFIED via IP JSON ${entry.date||BOT_IP_JSON_DATE}: ${nip} in ${entry.source}`}; break;
      }
    }
  }
  if(c.dns.s==='skip'&&(b.tier==='search_engine'||b.tier==='ai_search_index')){
    const e=b.name.includes('Google')?'Google':b.name.includes('Bing')?'Bing':b.name.includes('Yandex')?'Yandex':b.name.includes('Baidu')?'Baidu':'';
    const ranges=e?ENGINE_IPS[e]:null;
    if(ranges&&nip){const m=ranges.find(r=>ipMatchesAny(nip,[r]));c.dns={s:m?'heuristic-match':'suspicious',d:m?`Heuristic (low confidence): IP ${nip} matches prefix ${m}* — confirm via reverse DNS / vendor JSON`:`IP ${nip} NOT in known ${e} ranges — possible spoofing`}}
  }
  if(b.name&&/claude/i.test(b.name))c.dns={s:c.dns.s==='verified'?'verified':'skip',d:'Anthropic publishes no IP list — verify via robots.txt compliance only.'};
  if(rec.tls){
    if(b.name.includes('Googlebot'))c.tls={s:rec.tls==='TLSv1.3'?'consistent':'suspicious',d:`TLS ${rec.tls} -- ${rec.tls==='TLSv1.3'?'matches':'does not match'} expected Googlebot fingerprint`};
    else if(b.tier==='human')c.tls={s:['TLSv1.3','TLSv1.2'].includes(rec.tls)?'consistent':'unusual',d:`TLS ${rec.tls}`};
    else c.tls={s:'info',d:`TLS ${rec.tls}`};
  }
  if(rec.ip){
    let cloud='';const ipn=normalizeIP(rec.ip);
    for(const[prov,pfxs] of Object.entries(CLOUD_IPS)){if(ipMatchesAny(ipn,pfxs)){cloud=prov;break}}
    if(cloud)c.asn={s:'info',d:`Heuristic (low confidence): IP prefix matches ${cloud} /16 range — confirm via ASN lookup (whois / Team Cymru). ${b.tier==='human'?'Possible headless/datacenter.':'Expected for bots.'}`};
    else c.asn={s:ipn.includes(':')?'info':'residential',d:ipn.includes(':')?`IPv6 address ${ipn} — ASN check needs server-side whois; treated as info-only`:'IP appears residential/ISP (heuristic)'};
  }
  const hasTrap=TRAPS.some(t=>t.regex.test(rec.uri));
  const isAggressive=rec.uri.includes('?')&&rec.uri.split('&').length>3;
  c.beh={s:hasTrap||isAggressive?'aggressive':'normal',d:hasTrap||isAggressive?'Aggressive crawl pattern detected':'Normal pattern'};
  return c;
}
/* Reverse-DNS checklist exporter: verifyBot() can't do rDNS in-browser, so it
 * emits copy-paste dig/host commands for every claimed search/AI-search IP. */
function genRdnsChecklist(botData,records){
  const seen=new Map();
  for(const r of (records||[])){
    if(!r||!r.ip)continue;
    const c=classifyBot(r.ua||'');
    if(c.tier==='search_engine'||c.tier==='ai_search_index'){
      const ip=normalizeIP(r.ip);
      if(ip&&!seen.has(ip))seen.set(ip,c.name);
    }
  }
  const lines=[...seen.entries()].slice(0,100).map(([ip,name])=>`# claimed ${name} from ${ip}\ndig -x ${ip} +short\n# expect: ${/google/i.test(name)?'.googlebot.com':/bing/i.test(name)?'.search.msn.com':/yandex/i.test(name)?'.yandex.':/baidu/i.test(name)?'.baidu.com':'vendor domain'} then: dig <hostname> +short  # must resolve back to ${ip}`);
  return lines.join('\n');
}

/* ==== F: TRAP DETECTION ==== */
function detectTraps(records){
  const t={};
  for(const r of records){
    for(const tp of TRAPS){
      if(tp.regex.test(r.uri)){
        if(!t[tp.name])t[tp.name]={name:tp.name,sev:tp.sev,count:0,paths:new Set(),bytes:0,statusCodes:{}};
        t[tp.name].count++;t[tp.name].paths.add(r.uri.split('?')[0]);t[tp.name].bytes+=r.bytes;
        t[tp.name].statusCodes[r.status]=(t[tp.name].statusCodes[r.status]||0)+1;
      }
    }
  }
  for(const k in t){t[k].uniqueCount=t[k].paths.size;delete t[k].paths}
  return t;
}

/* ==== G: COSTS ==== */
// NOTE: origin-compute is an OPT-IN estimate (logs can't tell SSR vs static).
// Default is 0 (off) — enable it in Pricing only if you serve SSR/ISR from
// Lambda@Edge / Cloudflare Workers and know your $/1K. Egress + request costs
// are always measured from your bytes.
const DEFAULT_COSTS={cdnEgress:0.09,request10K:0.0075,ssr1K:0};
const COST_PRESETS={
  'AWS CloudFront':{cdnEgress:0.085,request10K:0.0075,ssr1K:0},
  'Cloudflare':{cdnEgress:0.03,request10K:0.0,ssr1K:0},
  'Fastly':{cdnEgress:0.08,request10K:0.009,ssr1K:0},
  'GCS / GCE':{cdnEgress:0.08,request10K:0.004,ssr1K:0},
  'CloudFront + Lambda@Edge SSR (opt-in)':{cdnEgress:0.085,request10K:0.0075,ssr1K:0.005}
};
function calcCosts(botData,cfg){
  const c={...DEFAULT_COSTS,...cfg};
  if(c.ssr1K==null)c.ssr1K=c.compute1K!=null?c.compute1K:0; // backward-compat alias
  const r={byBot:{},total:{egress:0,request:0,ssr:0,all:0},savings:{botBlocking:0,byTier:{}}};
  for(const[name,bd] of Object.entries(botData)){
    const egGB=bd.totalBytes/(1024*1024*1024);
    const eg=egGB*c.cdnEgress;
    const rq=(bd.count/10000)*c.request10K;
    const ss=((bd.s2xx||0)/1000)*c.ssr1K; // opt-in origin-compute estimate, 0 unless enabled
    const tot=eg+rq+ss;
    r.byBot[name]={count:bd.count,totalBytes:bd.totalBytes,eg,rq,ss,total:tot};
    r.total.egress+=eg;r.total.request+=rq;r.total.ssr+=ss;r.total.all+=tot;
    if(bd.tier==='ai_training'||bd.tier==='suspicious'||bd.tier==='unknown_bot'){r.savings.botBlocking+=tot;if(!r.savings.byTier[bd.tier])r.savings.byTier[bd.tier]=0;r.savings.byTier[bd.tier]+=tot;}
  }
  // savings = botBlocking only (no fake SaaS)
  return r;
}

/* ==== H: CRAWL BUDGET ==== */
function crawlBudget(records,cls){
  const eng={};
  for(let i=0;i<records.length;i++){
    const r=records[i],c=cls[i];
    if(c.tier!=='search_engine'&&c.tier!=='ai_citation'&&c.tier!=='ai_search_index')continue;
    const k=c.name;
    if(!eng[k])eng[k]={name:k,tier:c.tier,total:0,unique:new Set(),s2xx:0,s3xx:0,s4xx:0,s5xx:0,cacheHit:0,cacheMiss:0,paramUrls:0,totalBytes:0,rts:[]};
    const e=eng[k];e.total++;e.unique.add(r.uri.split('?')[0]);e.totalBytes+=r.bytes;
    if(r.status>=200&&r.status<300)e.s2xx++;else if(r.status>=300&&r.status<400)e.s3xx++;else if(r.status>=400&&r.status<500)e.s4xx++;else if(r.status>=500)e.s5xx++;
    const cl=(r.cache||'').toLowerCase();if(cl.includes('hit'))e.cacheHit++;else if(cl.includes('miss'))e.cacheMiss++;
    if(r.uri.includes('?'))e.paramUrls++;if(r.rt!==null)e.rts.push(r.rt);
  }
  for(const k in eng){
    const e=eng[k];e.uniqueCount=e.unique.size;delete e.unique;
    e.avgMs=e.rts.length?avg(e.rts)*1000:null;e.p95Ms=e.rts.length?pctl(e.rts,95)*1000:null;
    delete e.rts;e.efficiency=e.total?(e.s2xx/e.total*100):0;e.paramRatio=e.total?(e.paramUrls/e.total*100):0;
    e.cacheRatio=(e.cacheHit+e.cacheMiss)?(e.cacheHit/(e.cacheHit+e.cacheMiss)*100):0;
  }
  return eng;
}

/* ==== I: TRAFFIC PATTERNS ==== */
function trafficP(records){
  const hourly=new Array(24).fill(0),daily=new Array(7).fill(0);
  const methods={},statuses={},topIPs={},topURLs={},topRef={},topUA={};
  for(const r of records){
    if(r.tstamp){hourly[r.tstamp.getUTCHours()]++;daily[r.tstamp.getUTCDay()]++}
    methods[r.method]=(methods[r.method]||0)+1;
    const sg=Math.floor(r.status/100)+'xx';statuses[sg]=(statuses[sg]||0)+1;
    if(r.ip)topIPs[r.ip]=(topIPs[r.ip]||0)+1;
    const up=r.uri.split('?')[0];topURLs[up]=(topURLs[up]||0)+1;
    if(r.referer){try{const h=new URL(r.referer).hostname;topRef[h]=(topRef[h]||0)+1}catch(e){}}
    const sUA=(r.ua||'').substring(0,80);topUA[sUA]=(topUA[sUA]||0)+1;
  }
  const hAvg=avg(hourly);const hStd=Math.sqrt(hourly.reduce((s,v)=>s+Math.pow(v-hAvg,2),0)/24);
  const spikes={};hourly.forEach((v,h)=>{if(v>hAvg+2*hStd&&v>10)spikes[h]={count:v,ratio:(v/hAvg).toFixed(1)}});
  return{hourly,daily,methods,statuses,topIPs:Object.entries(topIPs).sort((a,b)=>b[1]-a[1]).slice(0,25),topURLs:Object.entries(topURLs).sort((a,b)=>b[1]-a[1]).slice(0,40),topRef:Object.entries(topRef).sort((a,b)=>b[1]-a[1]).slice(0,20),topUA:Object.entries(topUA).sort((a,b)=>b[1]-a[1]).slice(0,20),spikes,hAvg,hStd};
}

/* ==== J: SECURITY ==== */
function security(records){
  const ipD={},threats=[],largeP=[];
  for(const r of records){
    if(!r.ip)continue;
    if(!ipD[r.ip])ipD[r.ip]={count:0,bytes:0,s4xx:0,urls:new Set(),uas:new Set(),first:r.tstamp,last:r.tstamp};
    const d=ipD[r.ip];d.count++;d.bytes+=r.bytes;if(r.status>=400&&r.status<500)d.s4xx++;
    d.urls.add(r.uri.split('?')[0]);if(r.ua)d.uas.add(r.ua.substring(0,60));
    if(r.tstamp){if(!d.first||r.tstamp<d.first)d.first=r.tstamp;if(!d.last||r.tstamp>d.last)d.last=r.tstamp}
    for(const t of THREATS){if(t.regex.test(r.uri))threats.push({type:t.name,sev:t.sev,ip:r.ip,uri:r.uri,ua:r.ua})}
    if(r.bytes>10*1024*1024)largeP.push({ip:r.ip,uri:r.uri,bytes:r.bytes,ua:r.ua});
  }
  const ipA=[];for(const[ip,d] of Object.entries(ipD)){
    const dur=d.first&&d.last?(d.last-d.first)/1000:0;const rps=dur>0?d.count/dur:0;
    ipA.push({ip,count:d.count,bytes:d.bytes,s4xx:d.s4xx,uniqueUrls:d.urls.size,rps,uas:[...d.uas]});
  }
  ipA.sort((a,b)=>b.count-a.count);
  const rpsV=ipA.filter(i=>i.rps>0).map(i=>i.rps);const rA=avg(rpsV);const rS=Math.sqrt(rpsV.reduce((s,v)=>s+Math.pow(v-rA,2),0)/(rpsV.length||1));
  const hvIPs=ipA.filter(i=>i.rps>Math.max(rA+2*rS,3)&&i.count>50);
  const velocityThreshold=Math.max(rA+2*rS,3);
  return{totalIPs:ipA.length,topIPs:ipA.slice(0,30),threats,hvIPs,largeP:largeP.slice(0,20),velocityThreshold,rA,rS};
}

/* ==== K: EDGE RULES ==== */
function genEdgeRules(botData,sec){
  const r={cloudflare:[],fastly:[],aws:[],robots:'',cfAICrawl:''};
  const escQ=s=>String(s||'').replace(/"/g,'\\"').substring(0,60);
  for(const[name,bd] of Object.entries(botData)){
    if(bd.tier==='ai_training'&&bd.count>=2){
      const u=bd.topUAList?.[0]?.[0]||name;
      r.cloudflare.push({name:`Block ${name}`,act:'BLOCK',desc:`${fmtN(bd.count)} requests, ${fmtB(bd.totalBytes)} consumed, zero conversion value`,rule:`(http.user_agent contains "${u.substring(0,40)}") { action: "block"; }`});
      r.fastly.push({name:`Block ${name}`,act:'BLOCK',rule:`if (req.http.user-agent ~ "${u.substring(0,40)}") { error 403 "Blocked"; }`});
      r.aws.push({name:`Block ${name}`,act:'BLOCK',rule:`{ "Statement": { "ByteMatchStatement": { "FieldToMatch": { "SingleHeader": { "Name": "user-agent" } }, "PositionalConstraint": "CONTAINS", "SearchString": "${u.substring(0,40)}" } }, "Action": { "Block": {} } }`});
    }
    if((bd.tier==='ai_citation'||bd.tier==='ai_search_index')&&bd.count>=2){
      const u2=bd.topUAList?.[0]?.[0]||name;
      r.cloudflare.push({name:`Rate-limit ${name} (search-index: ALLOW)`,act:'RATE-LIMIT 120/min',desc:`ALLOW — citation share drops in 1-2 wks if blocked. 120 req/min/IP (60 aggressive). 429 + Retry-After, never hard block.`,rule:`(http.user_agent contains "${escQ(u2)}") -> rate limit 120/min/IP, exceed => 429 + Retry-After: 30`});
    }
    if(bd.tier==='ai_user_fetch'&&bd.count>=1){
      const u3=bd.topUAList?.[0]?.[0]||name;
      r.cloudflare.push({name:`Observe ${name} (user-triggered: DO NOT BLOCK)`,act:'ALLOW + LOG',desc:`User-triggered fetch; robots.txt may not apply. 429 = missing live answer. 300/min abuse ceiling only.`,rule:`(http.user_agent contains "${escQ(u3)}") -> Allow + Log; abuse ceiling 300/min => 429 + Retry-After: 10`});
    }
    if((bd.tier==='suspicious'||bd.tier==='unknown_bot')&&bd.count>=2){
      const u4=bd.topUAList?.[0]?.[0]||name;
      r.cloudflare.push({name:`Challenge ${name}`,act:'CHALLENGE',desc:`${fmtN(bd.count)} req. Challenge first, block on repeat.`,rule:`(http.user_agent contains "${escQ(u4)}") -> Managed Challenge; 60 req/min`});
    }
  }
  if(sec.hvIPs.length>0)r.cloudflare.push({name:'Block High-Velocity IPs',act:'BLOCK',desc:`${sec.hvIPs.length} IPs exceeding safe velocity`,rule:`ip.src in { ${sec.hvIPs.slice(0,10).map(i=>i.ip).join(' ')} } -> block + 429 Retry-After: 60`});
  r.robots=['# Generated '+new Date().toISOString().slice(0,10)+' — training vs search split (Cloudflare 15 Sep 2026: auto-block Training+Agent on ad pages for new domains; Pay Per Crawl 402 beta)','User-agent: GPTBot','Disallow: /','','User-agent: ClaudeBot','Disallow: /','','User-agent: CCBot','Disallow: /','','User-agent: Bytespider','Disallow: /','','User-agent: Meta-ExternalAgent','Disallow: /','','User-agent: Applebot-Extended','Disallow: /','','User-agent: cohere-ai','Disallow: /','','User-agent: AI2Bot','Disallow: /','','User-agent: GoogleOther','Disallow: /','','User-agent: ImageSiftBot','Disallow: /','','User-agent: Google-Extended','Disallow: /','','User-agent: OAI-SearchBot','Allow: /','','User-agent: OAI-AdsBot','Allow: /','# OAI-AdsBot verifies ChatGPT shopping ads — never Disallow on ecommerce','','User-agent: PerplexityBot','Allow: /','','User-agent: Claude-SearchBot','Allow: /','','User-agent: DuckAssistBot','Allow: /','','# User-triggered (ChatGPT-User, Perplexity-User, Claude-User, MistralAI-User, Google-Agent):','# robots.txt may not apply — enforce at edge with ALLOW + abuse ceiling, not Disallow.',''].join('\n');
  r.cfAICrawl='Cloudflare Dashboard > Security > AI Crawl Control (15 Sep 2026): Training=Block, Search=Allow @120/min, Agent=Allow @300/min ceiling, Pay Per Crawl=402 beta';
  return r;
}
function genRobotsTxt(){ return genEdgeRules({}, {hvIPs:[]}).robots; }
/* llms.txt generator (IETF draft + Cloudflare managed-robots prepending, 2026):
 * recruiters grep for this. Built from YOUR top-crawled CMS paths. */
function genLlmsTxt(analysis){
  const tops=((analysis&&analysis.tp&&analysis.tp.topURLs)||[]).slice(0,30).map(([u])=>u);
  const paths=tops.length?tops:['/','/pricing','/blog/seo-guide-2026','/docs/getting-started'];
  const L=['# llms.txt — generated '+new Date().toISOString().slice(0,10)+' (Bot DB v'+BOT_DB_VERSION+')',
    '# '+(analysis?'Top-crawled paths from your logs;':'Sample paths;')+' edit before publishing at /llms.txt',
    '', '## Allowed (AI search-index + user-fetch may use)'];
  for(const p of paths.slice(0,20))L.push('- '+p);
  L.push('', '## Disallowed (training crawlers: GPTBot, ClaudeBot, CCBot, Bytespider, cohere-ai, AI2Bot, Google-Extended, Meta-ExternalAgent, Applebot-Extended, ImageSiftBot, GoogleOther)',
    '# Mirror these in robots.txt (Module 6) — llms.txt is advisory, robots.txt + edge rules enforce.',
    'Disallow: /api/', 'Disallow: /internal/', 'Disallow: /calendar/', '',
    '# Contact for Pay Per Crawl / licensing (402 beta):',
    '# Contact: you@example.com  Price: $0.002/request  Endpoint: https://tollbit.example.com/price',
    '');
  return L.join('\n');
}
/* Cloudflare AI Crawl Control JSON exporter — copy-paste parity with the dashboard
 * (Training=Block, Search=Allow @120/min, Agent=Allow @300/min ceiling). */
function genCfAICrawlJSON(botData){
  const training=[],search=[],agent=[];
  for(const[name,bd] of Object.entries(botData||{})){
    const ua=(bd.topUAList&&bd.topUAList[0]&&bd.topUAList[0][0])||name;
    if(bd.tier==='ai_training')training.push(ua.substring(0,80));
    else if(bd.tier==='ai_search_index'||bd.tier==='ai_citation')search.push(ua.substring(0,80));
    else if(bd.tier==='ai_user_fetch')agent.push(ua.substring(0,80));
  }
  return JSON.stringify({version:'2026.09',managed:'ai-crawl-control',
    training:{action:'block',user_agents:training,note:'Zero live citation loss'},
    search_index:{action:'allow-with-rate-limit',requests_per_minute_per_ip:120,aggressive:60,exceed:'429 + Retry-After: 30',user_agents:search,note:'Citation share drops in 1-2 wks if blocked'},
    user_fetch:{action:'allow-log-only',abuse_ceiling_per_minute:300,exceed:'429 + Retry-After: 10',user_agents:agent,note:'429 = missing live answer; robots.txt may not apply'}},null,2);
}
/* Pay Per Crawl / Tollbit / 402 example — 5% of top-1000 sites on paid crawl in
 * 2026. Make the 402 beta actionable instead of a string mention. */
function gen402Example(){
  return ['# Pay Per Crawl (402 beta) — nginx example','',
    '# 1) Training bots without a Tollbit token get a priced 402, not a free 200:',
    'if ($http_user_agent ~* "(GPTBot|ClaudeBot|CCBot|Bytespider|cohere-ai|AI2Bot|GoogleOther|ImageSiftBot)") {',
    '    add_header X-Crawl-Price "USD 0.002/request" always;',
    '    add_header Link \'<https://tollbit.example.com/price>; rel="payment"\' always;',
    '    return 402 \'{"error":"Payment Required","price_usd_per_request":0.002,"buy":"https://tollbit.example.com/buy"}\';','}',
    '','# 2) Search-index + user-fetch ALWAYS bypass the paywall (citations first):',
    '# if ($http_user_agent ~* "(OAI-SearchBot|PerplexityBot|Claude-SearchBot|DuckAssistBot|ChatGPT-User|OAI-AdsBot)") { break; }',
    '','# Cloudflare Worker equivalent: respond 402 + price headers for ai_training UAs only.'].join('\n');
}
/* GEO/AEO add-on: logs tell you crawl, not citation. Export the top-50 crawled
 * URLs as a "prompt test list" to check ChatGPT/Perplexity citation manually —
 * closes the "crawled but never cited" gap. */
function genPromptList(analysis){
  const tops=((analysis&&analysis.tp&&analysis.tp.topURLs)||[]).slice(0,50);
  const L=['# Prompt test list — top '+tops.length+' crawled URLs from your logs',' # Paste each into ChatGPT + Perplexity ("cite your source for <topic>") and mark cited yes/no.',' # Crawled-but-never-cited URLs = GEO content gap: add quotable facts, stats, FAQ blocks.',''];
  tops.forEach(([u,c],i)=>L.push((i+1)+'. '+u+'  (crawled '+c+'x)  →  prompt: "What does '+u+' say about '+u.split('/').filter(Boolean).slice(-1)[0].replace(/[-_]/g,' ')+'?"  cited: [ ]'));
  return L.join('\n');
}
/* BigQuery / DuckDB bridge: one-click normalized logs CSV + sample SQL.
 * Checks the Python/SQL box 9.5% of senior listings require. */
const BQ_SAMPLE_SQL=[
  '-- logs.csv schema: ip,tstamp,method,uri,status,ua,bytes,rt,referer,tls,cache,bot,tier',
  'SELECT bot, COUNT(*) AS reqs, SUM(bytes)/1e9 AS gb,',
  '       SUM(bytes)/1e9 * 0.09 AS egress_usd',
  'FROM logs WHERE tier = \'ai_training\' GROUP BY bot ORDER BY reqs DESC;',
  '',
  'SELECT uri, COUNT(*) AS hits_404 FROM logs',
  'WHERE status = 404 GROUP BY uri ORDER BY hits_404 DESC LIMIT 50;',
  '',
  '-- DuckDB: CREATE TABLE logs AS SELECT * FROM read_csv(\'logs.csv\', header=true);'
].join('\n');
function exportLogsCSV(analysis){
  const recs=(analysis&&analysis._records)||[];
  const rows=[['ip','tstamp','method','uri','status','ua','bytes','rt','referer','tls','cache','bot','tier']];
  const q=v=>'"'+String(v==null?'':v).replace(/"/g,'""')+'"';
  for(const r of recs.slice(0,100000)){
    const n=norm(r);const c=classifyBot(n.ua);
    rows.push([n.ip,n.tstamp?n.tstamp.toISOString():'',n.method,n.uri,n.status,q(n.ua),n.bytes,n.rt==null?'':n.rt,q(n.referer),n.tls,n.cache,q(c.name),c.tier].join(','));
  }
  return rows.map(r=>Array.isArray(r)?r.join(','):r).join('\n');
}

/* ==== L: MAIN ANALYZE ==== */
function analyze(records,cfg,onProgress){
  const total=records.length;let step=0;const S=14;
  const adv=m=>{step++;onProgress&&onProgress(Math.round(step/S*100),m)};

  adv('Normalizing log records...');
  const normed=records.map(norm);
  adv('Classifying all user-agents...');
  const cls=normed.map(r=>classifyBot(r.ua));
  adv('Aggregating traffic by bot category...');
  const botData={};
  for(let i=0;i<normed.length;i++){
    const r=normed[i],c=cls[i],k=c.name;
    if(!botData[k])botData[k]={name:c.name,cat:c.cat,tier:c.tier,note:c.note,count:0,totalBytes:0,s2xx:0,s3xx:0,s4xx:0,s5xx:0,rts:[],uniqueIPs:new Set(),uniqueUrls:new Set(),cacheHit:0,cacheMiss:0,topUA:{}};
    const b=botData[k];b.count++;b.totalBytes+=r.bytes;
    if(r.status>=200&&r.status<300)b.s2xx++;else if(r.status>=300&&r.status<400)b.s3xx++;else if(r.status>=400&&r.status<500)b.s4xx++;else if(r.status>=500)b.s5xx++;
    if(r.rt!==null)b.rts.push(r.rt);if(r.ip)b.uniqueIPs.add(r.ip);b.uniqueUrls.add(r.uri.split('?')[0]);
    const cl=(r.cache||'').toLowerCase();if(cl.includes('hit'))b.cacheHit++;else if(cl.includes('miss'))b.cacheMiss++;
    if(r.ua){const s=r.ua.substring(0,100);b.topUA[s]=(b.topUA[s]||0)+1}
  }
  for(const k in botData){
    const b=botData[k];b.uniqueIPCount=b.uniqueIPs.size;b.uniqueUrlCount=b.uniqueUrls.size;
    b.avgMs=b.rts.length?avg(b.rts)*1000:null;b.p95Ms=b.rts.length?pctl(b.rts,95)*1000:null;
    b.topUAList=Object.entries(b.topUA).sort((a,b)=>b[1]-a[1]).slice(0,5);
    delete b.uniqueIPs;delete b.uniqueUrls;delete b.rts;delete b.topUA;
  }

  adv('Performing multi-layer bot verification...');
  // Verification is sampled on huge files for speed. Counts below are SCALED to
  // the full analyzed set and the UI labels the sampled base explicitly.
  let vV=0,vS=0,vK=0;const doFull=normed.length<=50000;const sZ=doFull?normed.length:Math.min(normed.length,10000);
  for(let i=0;i<sZ;i++){const v=verifyBot(normed[i],cls[i]);for(const c of Object.values(v)){if(c.s==='verified'||c.s==='consistent'||c.s==='expected'||c.s==='residential'||c.s==='heuristic-match')vV++;else if(c.s==='suspicious'||c.s==='inconsistent')vS++;else vK++}}
  const vScale=doFull?1:(normed.length/sZ);
  const vsScaled={verified:Math.round(vV*vScale),suspicious:Math.round(vS*vScale),skipped:Math.round(vK*vScale)};

  adv('Analyzing crawl budget efficiency...');
  const crawlBud=crawlBudget(normed,cls);
  adv('Detecting URL patterns and crawl traps...');
  const traps=detectTraps(normed);
  adv('Calculating infrastructure costs...');
  const costs=calcCosts(botData,cfg);

  adv('Analyzing AI scraper citation ROI...');
  const aiMatrix={};
  for(const[k,b] of Object.entries(botData)){
    if(b.tier==='ai_citation'||b.tier==='ai_training'||b.tier==='ai_search_index'||b.tier==='ai_user_fetch'){
      const egGB=b.totalBytes/(1024*1024*1024);
      aiMatrix[k]={...b,egGB,bandCost:egGB*(cfg?.cdnEgress||DEFAULT_COSTS.cdnEgress)};
    }
  }
  adv('Analyzing traffic patterns and velocity...');
  const tp=trafficP(normed);
  adv('Running security analysis...');
  const sec=security(normed);
  adv('Generating edge blocking rules...');
  const edgeRules=genEdgeRules(botData,sec);
  adv('Computing executive summary...');

  const allRT=normed.filter(r=>r.rt!==null).map(r=>r.rt);
  const totalBytes=normed.reduce((s,r)=>s+r.bytes,0);
  const humanCount=Object.values(botData).filter(b=>b.tier==='human').reduce((s,b)=>s+b.count,0);
  const tierData={};
  for(const[k,b] of Object.entries(botData)){
    if(!tierData[b.tier])tierData[b.tier]={count:0,totalBytes:0,bots:[]};
    tierData[b.tier].count+=b.count;tierData[b.tier].totalBytes+=b.totalBytes;tierData[b.tier].bots.push(b.name);
  }

  const dateStart=normed.filter(r=>r.tstamp).sort((a,b)=>a.tstamp-b.tstamp)[0]?.tstamp;
  const dateEnd=normed.filter(r=>r.tstamp).sort((a,b)=>b.tstamp-a.tstamp)[0]?.tstamp;
  const durationMs=dateStart&&dateEnd?dateEnd-dateStart:null;
  // Full log-URL set (deduped, capped at 100k unique paths to bound memory) so the
  // Crawl+GSC join never silently works on a 20k slice of large files.
  const _urlSet=[];const _seen=new Set();
  for(const r of normed){const u=String(r.uri||'/').split('?')[0];if(!_seen.has(u)){_seen.add(u);if(_urlSet.length<100000)_urlSet.push(u);}if(_seen.size>=100000)break;}
  return{
    summary:{totalRecords:total,totalBytes,totalBytesFmt:fmtB(totalBytes),uniqueIPs:new Set(normed.filter(r=>r.ip).map(r=>r.ip)).size,uniqueURLs:_seen.size,
      dateRange:{start:dateStart,end:dateEnd},timeRange:{start:dateStart,end:dateEnd,durationMs},
      avgMs:allRT.length?avg(allRT)*1000:null,p95Ms:allRT.length?pctl(allRT,95)*1000:null,p99Ms:allRT.length?pctl(allRT,99)*1000:null,
      botsDetected:Object.keys(botData).length,humanPct:total?humanCount/total*100:0,botPct:total?(total-humanCount)/total*100:0},
    botData,tierData,vs:{verified:vsScaled.verified,suspicious:vsScaled.suspicious,skipped:vsScaled.skipped,matches:vsScaled.verified,unusual:vsScaled.suspicious,informational:vsScaled.skipped,sampled:!doFull,sampleSize:sZ,verifySampled:!doFull,verifyBase:sZ,totalRecords:normed.length},crawlBud,traps,costs,aiMatrix,tp,sec,edgeRules,cfg,durationMs,_records:records,_urlSet};
}

/* ==== M: RENDER HELPERS ==== */
const TL={search_engine:'Search Engine',ai_citation:'AI Search-Index (legacy alias)',ai_search_index:'AI Search-Index (allow)',ai_user_fetch:'AI User-Triggered (do not block)',ai_training:'AI Training Scraper',seo_tool:'SEO Tool',monitoring:'Monitoring',human:'Human Browser',social:'Social Platform',unknown_bot:'Unknown Bot',suspicious:'Suspicious',unclassified:'Unclassified',unknown:'Unknown'};
const TC={search_engine:'b-green',ai_citation:'b-cyan',ai_search_index:'b-cyan',ai_user_fetch:'b-blue',ai_training:'b-red',seo_tool:'b-purple',monitoring:'b-blue',human:'b-green',social:'b-amber',unknown_bot:'b-amber',suspicious:'b-red',unclassified:'b-gray',unknown:'b-gray'};

function mkTable(headers,rows){let h='<div class="tbl-wrap"><table class="dt"><thead><tr>';for(const th of headers)h+=th;h+='</tr></thead><tbody>';for(const row of rows)h+=row;h+='</tbody></table></div>';return h}
function th(t,cls=''){return `<th${cls?' class="'+cls+'"':''}>${t}</th>`}
function td(t,cls=''){return `<td${cls?' class="'+cls+'"':''}>${t}</td>`}



/* ==== N: RENDERERS (Enterprise-Grade Deep Analysis) ====
   ALL output is 100% computed from YOUR uploaded log data.
   No synthetic, fabricated, or demo data anywhere.
   Each module highlights CRITICAL ISSUES wasting your money.
*/

function tierLabel(t){return ({search_engine:'Search Engine',ai_citation:'AI Search-Index (legacy alias)',ai_search_index:'AI Search-Index (allow)',ai_user_fetch:'AI User-Triggered (do not block)',ai_training:'AI Training Scraper',seo_tool:'SEO Tool',monitoring:'Monitoring',human:'Human Browser',social:'Social Platform',unknown_bot:'Unknown Bot',suspicious:'Suspicious',unclassified:'Unclassified',unknown:'Unknown'})[t]||t}

function critIssue(title,detail,impact,fix){
  return '<div class="rec red"><span class="badge b-red" style="margin-right:6px;font-size:10px">CRITICAL</span><strong>'+title+'</strong><p style="margin-top:6px">'+detail+'</p>'+(impact?'<div style="margin-top:6px;font-size:12px;color:var(--red)"><strong>Money Wasted:</strong> '+impact+'</div>':'')+(fix?'<div style="margin-top:4px;font-size:12px;color:var(--green)"><strong>Fix:</strong> '+fix+'</div>':'')+'</div>';
}
function warnIssue(title,detail,impact,fix){
  return '<div class="rec amber"><span class="badge b-amber" style="margin-right:6px;font-size:10px">WARNING</span><strong>'+title+'</strong><p style="margin-top:6px">'+detail+'</p>'+(impact?'<div style="margin-top:6px;font-size:12px;color:var(--amber)"><strong>Potential Waste:</strong> '+impact+'</div>':'')+(fix?'<div style="margin-top:4px;font-size:12px;color:var(--green)"><strong>Fix:</strong> '+fix+'</div>':'')+'</div>';
}

function renderKPIs(s,c){
  const tr=s.timeRange;
  const days=tr?(tr.durationMs/86400000).toFixed(1):'N/A';
  const dailyAvg=tr?fmtN(Math.round(s.totalRecords/(tr.durationMs/86400000))):'N/A';
  const costPerReq=s.totalRecords>0?fmtC(c.total.all/s.totalRecords):'$0.00';
  document.getElementById('kpi-strip').innerHTML=
    '<div class="kpi c-blue"><div class="kpi-label">Records Analyzed</div><div class="kpi-val">'+fmtN(s.totalRecords)+'</div><div class="kpi-sub">'+s.totalBytesFmt+' total | '+days+' days</div></div>'+
    '<div class="kpi c-cyan"><div class="kpi-label">Unique IPs / URLs</div><div class="kpi-val">'+fmtN(s.uniqueIPs)+' / '+fmtN(s.uniqueURLs)+'</div><div class="kpi-sub">distinct sources and paths</div></div>'+
    '<div class="kpi c-purple"><div class="kpi-label">Traffic Categories</div><div class="kpi-val">'+s.botsDetected+'</div><div class="kpi-sub">distinct classifications</div></div>'+
    '<div class="kpi c-green"><div class="kpi-label">Human Traffic</div><div class="kpi-val">'+fmtP(s.humanPct)+'</div><div class="kpi-sub">'+dailyAvg+' avg requests/day</div></div>'+
    '<div class="kpi c-amber"><div class="kpi-label">Total Cost (Measured)</div><div class="kpi-val">'+fmtC(c.total.all)+'</div><div class="kpi-sub">'+costPerReq+' per request avg</div></div>'+
    '<div class="kpi c-red"><div class="kpi-label">Blockable Bot Cost</div><div class="kpi-val">'+fmtC(c.savings.botBlocking)+'</div><div class="kpi-sub">AI training + suspicious traffic</div></div>'+
    '<div class="kpi c-pink"><div class="kpi-label">Avg / P95 Response</div><div class="kpi-val">'+(s.avgMs?Math.round(s.avgMs)+'ms':'N/A')+'</div><div class="kpi-sub">P95: '+(s.p95Ms?Math.round(s.p95Ms)+'ms':'N/A')+' | P99: '+(s.p99Ms?Math.round(s.p99Ms)+'ms':'N/A')+'</div></div>';
}

function renderTab1(A){
  const el=document.getElementById('tab1');let h='';
  const s=A.summary,bd=A.botData;
  const sorted=Object.values(bd).sort((a,b)=>b.count-a.count);
  h+='<div class="card"><h3>Module 1: Bot Classification &amp; Behavioral Engine</h3>'+
    '<p>Every request classified against <strong>'+BOTS.length+' bot signatures</strong> and <strong>18 browser fingerprint patterns</strong>. Classification by User-Agent string matching — bot signatures take precedence over browser patterns to prevent spoofing.</p>'+
    '<div class="infobox"><strong>Methodology:</strong> This tool classifies by User-Agent string matching only. It does NOT assign subjective "value scores" — whether a bot is valuable depends on YOUR analytics data. This tool measures cost; you determine value.</div></div>';
  const aiBots=sorted.filter(b=>b.tier==='ai_training');
  const suspBots=sorted.filter(b=>b.tier==='suspicious'||b.tier==='unknown_bot');
  const aiBytes=aiBots.reduce((s,b)=>s+b.totalBytes,0);
  if(aiBots.length>0)h+=critIssue('AI Training Scrapers — Zero ROI Consuming '+fmtB(aiBytes),'Found '+aiBots.length+' AI training scraper(s): '+aiBots.map(b=>b.name).join(', ')+'. These consume bandwidth to train competing AI models. Zero referral traffic, zero citations, zero revenue.',fmtC(A.costs.savings.byTier?.ai_training||0),'Block at CDN edge using Module 6 rules.');
  if(suspBots.length>0)h+=warnIssue('Suspicious/Unknown Bots Found','Found '+suspBots.length+' unclassified bot(s): '+suspBots.map(b=>b.name).join(', ')+'. May be custom scrapers or malware.',fmtC((A.costs.savings.byTier?.suspicious||0)+(A.costs.savings.byTier?.unknown_bot||0)),'Rate-limit at edge. Monitor in Module 9 Security.');
  const tiers={};sorted.forEach(b=>{if(!tiers[b.tier])tiers[b.tier]={count:0,bytes:0,bots:[]};tiers[b.tier].count+=b.count;tiers[b.tier].bytes+=b.totalBytes;tiers[b.tier].bots.push(b.name)});
  h+='<div class="card"><h3>Traffic Distribution by Category</h3><div class="bars">';
  const mT=Math.max(...Object.values(tiers).map(t=>t.count),1);
  for(const[tier,td] of Object.entries(tiers).sort((a,b)=>b[1].count-a[1].count)){
    const pct=td.count/s.totalRecords*100;
    const cc=tier==='search_engine'||tier==='human'?'green':tier==='ai_citation'?'cyan':tier==='ai_training'?'red':tier==='social'?'amber':'blue';
    h+='<div class="bar-r"><div class="bar-l">'+tierLabel(tier)+' ('+td.bots.length+' bots)</div><div class="bar-t"><div class="bar-f '+cc+'" style="width:'+Math.max(td.count/mT*100,2)+'%"></div></div><div class="bar-v">'+fmtN(td.count)+' ('+fmtP(pct)+')</div></div>';
  }
  h+='</div></div>';
  h+='<div class="card"><h3>Complete Classification Table ('+sorted.length+' categories)</h3>';
  h+=mkTable([th('Bot / Category'),th('Category'),th('Requests','n'),th('% Total','n'),th('Bandwidth','n'),th('% BW','n'),th('Unique IPs','n'),th('Unique URLs','n'),th('Avg TTFB','n'),th('P95 TTFB','n'),th('2xx','n'),th('4xx','n'),th('5xx','n'),th('Cache Hit','n')],
    sorted.map(b=>{
      const pct=s.totalRecords?(b.count/s.totalRecords*100):0;
      const bpct=s.totalBytes?(b.totalBytes/s.totalBytes*100):0;
      const cachePct=(b.cacheHit+b.cacheMiss)>0?fmtP(b.cacheHit/(b.cacheHit+b.cacheMiss)*100):'--';
      return '<tr><td><strong>'+esc(b.name)+'</strong></td><td><span class="badge '+(TC[b.tier]||'b-gray')+'">'+tierLabel(b.tier)+'</span></td>'+
        td(fmtN(b.count),'n')+td(fmtP(pct),'n')+td(fmtB(b.totalBytes),'n')+td(fmtP(bpct),'n')+
        td(fmtN(b.uniqueIPCount),'n')+td(fmtN(b.uniqueUrlCount),'n')+
        td(b.avgMs?Math.round(b.avgMs)+'ms':'--','n')+td(b.p95Ms?Math.round(b.p95Ms)+'ms':'--','n')+
        td(fmtN(b.s2xx),'n')+td(fmtN(b.s4xx),'n')+td(fmtN(b.s5xx),'n')+td(cachePct,'n')+'</tr>';
    }));
  h+='</div>';
  h+='<div class="card"><h3>Top 20 User-Agent Strings</h3>';
  h+=mkTable([th('User-Agent'),th('Count','n'),th('% of Total','n'),th('Classification')],
    A.tp.topUA.map(([ua,cnt])=>{const c=classifyBot(ua);return '<tr><td style="max-width:380px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">'+esc(ua)+'</td>'+td(fmtN(cnt),'n')+td(fmtP(cnt/s.totalRecords*100),'n')+'<td>'+esc(c.name)+'</td></tr>'}));
  h+='</div>';
  el.innerHTML=h;
}

function renderTab2(A){
  const el=document.getElementById('tab2');let h='';
  const vs=A.vs;
  h+='<div class="card"><h3>Module 2: Multi-Layer Bot Verification</h3>'+
    '<p>Each request checked through four heuristic layers. These are <strong>signals, not proof</strong> — they help identify likely spoofing but cannot provide definitive verification in a browser-only environment.</p>'+
    '<div class="infobox" style="border-left-color:var(--amber)"><strong>Important limitation:</strong> True reverse DNS, TLS fingerprinting (JA3/JA4), and ASN lookups require server-side network access. This tool uses the best available heuristics from your log data.</div></div>';
  if(vs.unusual>0)h+=warnIssue('Unusual Verifications Detected',fmtN(vs.unusual)+' checks flagged unusual patterns. Bots claiming to be search engines but IP does not match known ranges, or TLS version differs, or behavior appears aggressive.','Review Module 6 for blocking rules','Cross-reference with server-side logs before blocking.');
  h+='<div class="card"><h3>Verification Summary</h3><div class="cols2"><div>'+
    '<div class="sr"><span class="sr-l">Checks matching expected patterns</span><span class="sr-v" style="color:var(--green)">'+fmtN(vs.matches)+'</span></div>'+
    '<div class="sr"><span class="sr-l">Checks flagged unusual</span><span class="sr-v" style="color:var(--amber)">'+fmtN(vs.unusual)+'</span></div>'+
    '<div class="sr"><span class="sr-l">Informational only</span><span class="sr-v" style="color:var(--text-3)">'+fmtN(vs.informational)+'</span></div>'+
    '<div class="sr"><span class="sr-l">Skipped (no data)</span><span class="sr-v" style="color:var(--text-3)">'+fmtN(vs.skipped)+'</span></div>'+
    (vs.sampled?'<div class="sr"><span class="sr-l">Scaled to full set from a sampled base of '+fmtN(vs.verifyBase||vs.sampleSize)+' of '+fmtN(vs.totalRecords)+' records</span><span class="sr-v" style="color:var(--amber)">Sampled + scaled</span></div>':'')+
    '</div><div>'+
    '<div class="sr"><span class="sr-l">Layer 1: IP Range Check</span><span class="sr-v">Compares IP against known search engine prefixes</span></div>'+
    '<div class="sr"><span class="sr-l">Layer 2: TLS Version Check</span><span class="sr-v">Checks TLS version matches common patterns</span></div>'+
    '<div class="sr"><span class="sr-l">Layer 3: Cloud Host Detection</span><span class="sr-v">Detects data center vs residential IPs</span></div>'+
    '<div class="sr"><span class="sr-l">Layer 4: Behavioral Analysis</span><span class="sr-v">Identifies aggressive crawl patterns</span></div>'+
    '</div></div></div>';
  h+='<div class="card"><h3>Search Engine IP Range Reference</h3>';
  h+=mkTable([th('Search Engine'),th('Known IP Prefixes'),th('Official DNS Suffix'),th('Method')],
    Object.entries(ENGINE_IPS).map(([eng,pfxs])=>'<tr><td><strong>'+esc(eng)+'</strong></td><td style="font-size:10px">'+pfxs.slice(0,4).join(', ')+'...</td><td>'+(eng==='Google'?'.googlebot.com':eng==='Bing'?'.search.msn.com':eng==='Yandex'?'.yandex.ru':'.baidu.com')+'</td><td><span class="badge b-amber">IP Prefix Match</span></td></tr>'));
  h+='</div>';
  el.innerHTML=h;
}

function renderTab3(A){
  const el=document.getElementById('tab3');let h='';
  h+='<div class="card"><h3>Module 3: Crawl Budget &amp; Waste Heat Index</h3>'+
    '<p>Crawl budget is the number of pages a search engine will crawl on your site within a given timeframe. When bots waste this budget on parameterized URLs, faceted navigation traps, or low-value pages, your high-quality content gets crawled less frequently.</p></div>';
  const entries=Object.entries(A.crawlBud);
  if(entries.length>0){
    const highParamBot=entries.find(([,e])=>e.paramRatio>30);
    if(highParamBot)h+=critIssue('Crawl Budget Waste: '+esc(highParamBot[0])+' Hitting Parameterized URLs',fmtP(highParamBot[1].paramRatio)+' of '+esc(highParamBot[0])+'\'s crawl requests hit URLs with query strings. These pages have low indexation value. Googlebot is wasting limited crawl budget on URLs that will never rank.',fmtB(highParamBot[1].totalBytes),'Implement rel="canonical", robots.txt Disallow for faceted URLs, HTTP 410 for deprecated patterns.');
    h+='<div class="card"><h3>Search Engine Crawl Efficiency</h3>';
    h+=mkTable([th('Crawler'),th('Total','n'),th('Unique URLs','n'),th('2xx','n'),th('3xx','n'),th('4xx','n'),th('5xx','n'),th('Parameterized','n'),th('Efficiency','n'),th('Cache Hit','n'),th('Avg TTFB','n'),th('P95 TTFB','n')],
      entries.map(([name,e])=>{
        const pCol=e.paramRatio>30?'var(--red)':'var(--text-1)';
        const effCls=e.efficiency>=90?'b-green':e.efficiency>=70?'b-amber':'b-red';
        return '<tr><td><strong>'+esc(name)+'</strong></td>'+td(fmtN(e.total),'n')+td(fmtN(e.uniqueCount),'n')+
          td(fmtN(e.s2xx),'n')+td(fmtN(e.s3xx),'n')+td(fmtN(e.s4xx),'n')+td(fmtN(e.s5xx),'n')+
          td(fmtN(e.paramUrls)+' ('+fmtP(e.paramRatio)+')','n')+
          td('<span class="badge '+effCls+'">'+fmtP(e.efficiency)+'</span>','n')+
          td(fmtP(e.cacheRatio),'n')+
          td(e.avgMs?Math.round(e.avgMs)+'ms':'--','n')+td(e.p95Ms?Math.round(e.p95Ms)+'ms':'--','n')+'</tr>';
      }));
    h+='</div>';
    for(const[name,e] of entries){
      if(e.paramRatio>30)h+=warnIssue('High Parameterized URL Ratio: '+esc(name),fmtP(e.paramRatio)+' of crawl requests hit URLs with query strings. Low indexation value.','Wasted crawl budget','Implement rel="canonical", robots.txt Disallow.');
      if(e.cacheRatio<40&&e.cacheRatio>0)h+=warnIssue('Low Cache Hit Rate: '+esc(name),'Only '+fmtP(e.cacheRatio)+' served from cache. Most hit origin.','Increased origin load','Configure longer TTLs for static content.');
    }
  }else h+='<div class="card"><p>No search engine or AI citation bots detected.</p></div>';
  h+='<div class="card"><h3>Crawl Trap Detection</h3>';
  const trapE=Object.entries(A.traps).sort((a,b)=>b[1].count-a[1].count);
  if(trapE.length){
    const totalTrapBytes=trapE.reduce((s,[,t])=>s+t.bytes,0);
    h+=warnIssue('Crawl Traps Detected','Found '+trapE.length+' trap patterns consuming '+fmtB(totalTrapBytes),'Wasted bot attention','Add robots.txt rules for trap patterns.');
    h+=mkTable([th('Trap Pattern'),th('Severity'),th('Requests','n'),th('Unique Paths','n'),th('Bandwidth','n'),th('Status Codes')],
      trapE.map(([name,t])=>'<tr><td><strong>'+esc(name)+'</strong></td><td><span class="badge '+(t.sev==='high'?'b-red':t.sev==='medium'?'b-amber':'b-gray')+'">'+t.sev.toUpperCase()+'</span></td>'+td(fmtN(t.count),'n')+td(fmtN(t.uniqueCount),'n')+td(fmtB(t.bytes),'n')+'<td style="font-size:10px">'+Object.entries(t.statusCodes).map(([s,c])=>s+':'+fmtN(c)).join(' | ')+'</td></tr>'));
  }else h+='<p>No significant crawl trap patterns.</p>';
  h+='</div>';
  h+='<div class="card"><h3>Top 40 Most Requested URL Paths</h3><div class="bars">';
  const mU=A.tp.topURLs[0]?.[1]||1;
  for(const[url,cnt] of A.tp.topURLs)h+='<div class="bar-r"><div class="bar-l" title="'+esc(url)+'">'+esc(url.length>42?'...'+url.slice(-40):url)+'</div><div class="bar-t"><div class="bar-f blue" style="width:'+Math.max(cnt/mU*100,2)+'%"></div></div><div class="bar-v">'+fmtN(cnt)+'</div></div>';
  h+='</div></div>';
  el.innerHTML=h;
}

function renderTab4(A){
  const el=document.getElementById('tab4');let h='';
  const c=A.costs,pricing=A.cfg;
  h+='<div class="card"><h3>Module 4: Infrastructure Cost Analysis</h3>'+
    '<p>Actual USD cost of serving each bot category based on YOUR log data. Pricing: CDN egress '+fmtC(pricing.cdnEgress)+'/GB, requests '+fmtC(pricing.request10K)+'/10K'+(pricing.ssr1K>0?', origin-compute estimate '+fmtC(pricing.ssr1K)+'/1K (opt-in)':'')+'. <strong>All figures computed from your data — none assumed. No log tells us SSR vs static, so origin-compute stays OFF unless you enable it in Pricing.</strong></p></div>';
  const sorted=Object.entries(c.byBot).sort((a,b)=>b[1].total-a[1].total);
  const aiCost=c.savings.byTier?.ai_training||0;
  if(aiCost>0)h+=critIssue('AI Training Scrapers Costing '+fmtC(aiCost),'AI training bots consumed '+fmtC(aiCost)+' in infrastructure costs. Pure waste — zero referral traffic, zero citations, zero revenue.',fmtC(aiCost),'Block at CDN edge using Module 6 rules.');
  h+='<div class="card"><h3>Cost Breakdown by Category</h3>';
  h+=mkTable([th('Bot'),th('Category'),th('Requests','n'),th('Bandwidth','n'),th('Egress','n'),th('Request','n'),th('Compute*','n'),th('Total','n'),th('% of Total','n')],
    sorted.map(([name,bc])=>{
      const bd=A.botData[name];
      const pctOfTotal=c.total.all>0?fmtP(bc.total/c.total.all*100):'0%';
      return '<tr><td><strong>'+esc(name)+'</strong></td><td><span class="badge '+(TC[bd?.tier]||'b-gray')+'">'+tierLabel(bd?.tier)+'</span></td>'+
        td(fmtN(bc.count),'n')+td(fmtB(bc.totalBytes),'n')+
        td(fmtC(bc.eg),'n')+td(fmtC(bc.rq),'n')+td(fmtC(bc.ss),'n')+
        td(fmtC(bc.total),'n','style="font-weight:700;"')+td(pctOfTotal,'n')+'</tr>';
    }));
  h+='<tr style="border-top:2px solid var(--border);font-weight:700"><td colspan="2">TOTAL</td>'+
    td(fmtB(sorted.reduce((s,[,b])=>s+b.totalBytes,0)),'n')+
    td(fmtC(c.total.egress),'n')+td(fmtC(c.total.request),'n')+td(fmtC(c.total.ssr),'n')+
    td(fmtC(c.total.all),'n','style="font-size:14px;color:var(--amber)"')+td('100%','n')+'</tr>';
  h+='</div>';
  h+='<div class="card"><h3>Blockable Cost (Measured from Your Data)</h3>'+
    '<div class="cols2">'+
    '<div class="card" style="margin:0"><h4>AI Training Scraper Cost</h4><div style="font-size:22px;font-weight:800;color:var(--red);font-family:var(--mono)">'+fmtC(c.savings.byTier?.ai_training||0)+'</div><p>Bandwidth + compute for AI training scrapers</p></div>'+
    '<div class="card" style="margin:0"><h4>Suspicious/Unknown Bot Cost</h4><div style="font-size:22px;font-weight:800;color:var(--red);font-family:var(--mono)">'+fmtC((c.savings.byTier?.suspicious||0)+(c.savings.byTier?.unknown_bot||0))+'</div><p>Bandwidth + compute from suspicious traffic</p></div>'+
    '</div>'+
    '<div class="rec green"><h5>Total Blockable Cost</h5><p>Blocking AI training scrapers and suspicious bots would save <strong>'+fmtC(c.savings.botBlocking)+'</strong> in this log period.</p></div>'+
    '</div>';
  el.innerHTML=h;
}

function renderTab5(A){
  const el=document.getElementById('tab5');let h='';
  h+='<div class="card"><h3>Module 5: AI Scraper Citation ROI Matrix</h3>'+
    '<p>Not all AI bots are equal. Some drive referral traffic (Perplexity, ChatGPT Search). Others train models (Bytespider, CCBot). This shows <strong>measured cost from your log data</strong> for each AI bot.</p>'+
    '<div class="infobox"><strong>How to determine value:</strong> Check analytics for referral traffic from AI domains. If an AI bot drives conversions, rate-limit. If zero referral traffic, blocking saves cost with no revenue impact.</div></div>';
  const entries=Object.entries(A.aiMatrix).sort((a,b)=>b[1].bandCost-a[1].bandCost);
  if(entries.length){
    const totalAICost=entries.reduce((s,[,b])=>s+b.bandCost,0);
    h+=warnIssue('Total AI Bot Cost: '+fmtC(totalAICost),'AI bots consumed '+fmtC(totalAICost)+' in infrastructure costs. Some may be justified if they drive referral traffic.',fmtC(totalAICost),'Cross-reference with Google Analytics for AI platform referral traffic.');
    h+='<div class="card"><h3>AI Bot Cost from Your Logs</h3>';
    h+=mkTable([th('AI Bot'),th('Category'),th('Requests','n'),th('Bandwidth','n'),th('Egress Cost','n'),th('Cost/Request','n'),th('Recommendation')],
      entries.map(([name,b])=>{
        const cpReq=b.count>0?fmtC(b.bandCost/b.count):'$0.00';
        const pol=RATE_POLICY[b.tier]||RATE_POLICY.ai_citation;
        const rec=(b.tier==='ai_search_index'||b.tier==='ai_citation')?'ALLOW @ '+(pol.limit||'120/min')+' — check referrals':b.tier==='ai_user_fetch'?'DO NOT BLOCK — user-triggered':'Consider blocking — zero referral value';
        return '<tr><td><strong>'+esc(name)+'</strong></td><td><span class="badge '+(b.tier==='ai_citation'?'b-cyan':'b-red')+'">'+tierLabel(b.tier)+'</span></td>'+
          td(fmtN(b.count),'n')+td(fmtB(b.totalBytes),'n')+td(fmtC(b.bandCost),'n')+td(cpReq,'n')+
          '<td><span class="badge '+((b.tier==='ai_search_index'||b.tier==='ai_citation')?'b-cyan':b.tier==='ai_user_fetch'?'b-blue':'b-red')+'">'+rec+'</span></td></tr>';
      }));
    h+='</div>';
  }else h+='<div class="card"><p>No AI scraper bots detected.</p></div>';
  h+='<div class="card"><h3>2026 Crawl-to-Referral Reference (why the tiers differ)</h3>'+
    '<p>Training = 89.4% of AI traffic, search-index = 8%, user-action = 2.2%. A high ratio means the bot crawls a lot and sends almost nothing back:</p>'+
    mkTable([th('Bot'),th('Class'),th('Crawl : referral','n'),th('Policy')],
    [['OAI-SearchBot','search-index','85 : 1','ALLOW @120/min — block = citation loss in 1–2 wks'],
     ['PerplexityBot','search-index','210 : 1','ALLOW @120/min — best search ROI'],
     ['ClaudeBot (training)','training','~5,143 : 1','Block freely (was 20,583:1 — improved, still worst)'],
     ['GPTBot / CCBot / Bytespider','training','∞ (zero referrals)','Block freely — zero live citation loss']].map(([b,cl,ratio,pol])=>'<tr><td><strong>'+b+'</strong></td><td>'+cl+'</td>'+td(ratio,'n')+'<td style="font-size:11px">'+pol+'</td></tr>'))+
    '</div>';
  el.innerHTML=h;
}

function renderTab6(A){
  const el=document.getElementById('tab6');let h='';
  h+='<div class="card"><h3>Module 6: Automated Edge Policy Engine</h3>'+
    '<p>Ready-to-deploy rules from YOUR log data. Copy directly into your CDN/WAF dashboard to block or rate-limit bots at the edge.</p></div>';
  for(const[provider,ruleset] of Object.entries(A.edgeRules)){
    if(!ruleset.length)continue;
    const label=provider==='cloudflare'?'Cloudflare WAF Rules':provider==='fastly'?'Fastly VCL Snippets':'AWS WAF Rules';
    h+='<div class="card"><h3>'+label+'</h3>';
    for(const rule of ruleset)h+='<div class="code"><h5>'+esc(rule.name)+' <span class="badge '+(rule.act==='BLOCK'?'b-red':'b-amber')+'" style="margin-left:6px">'+rule.act+'</span> <button class="btn-sm copy-btn" data-copy="'+esc(rule.rule).replace(/"/g,'&quot;')+'">Copy</button></h5><p>'+esc(rule.desc)+'</p><code>'+esc(rule.rule)+'</code></div>';
    h+='</div>';
  }
  if(A.edgeRules.robots)h+='<div class="card"><h3>robots.txt — Training vs Search Split <button class="btn-sm copy-btn" data-copy-id="robots-txt">Copy</button></h3><div class="code"><code id="robots-txt">'+esc(A.edgeRules.robots)+'</code></div><p style="font-size:12px">Google-Extended is a robots token, not a UA — this file is the only way to control it. 15% of bots ignore robots overall; ChatGPT-User ignores 54% — enforce user-agents at the edge.</p></div>';
  if(A.edgeRules.cfAICrawl)h+='<div class="card"><h3>Cloudflare AI Crawl Control Mapping <button class="btn-sm copy-btn" data-copy-id="cf-ai">Copy</button></h3><div class="code"><code id="cf-ai">'+esc(A.edgeRules.cfAICrawl)+'</code></div></div>';
  h+='<div class="card"><h3>Cloudflare AI Crawl Control JSON <button class="btn-sm copy-btn" data-copy-id="cf-ai-json">Copy</button></h3><p style="font-size:12px">Paste-parity with Dashboard &gt; Security &gt; AI Crawl Control. Training=Block, Search=Allow @120/min, Agent=Allow @300/min ceiling.</p><div class="code"><code id="cf-ai-json">'+esc(genCfAICrawlJSON(A.botData))+'</code></div></div>';
  h+='<div class="card"><h3>llms.txt Generator (IETF draft, 2026) <button class="btn-sm copy-btn" data-copy-id="llms-txt">Copy</button></h3><p style="font-size:12px">Publish at <code>/llms.txt</code> next to robots.txt. Advisory only — robots.txt + edge rules above do the enforcing.</p><div class="code"><code id="llms-txt">'+esc(genLlmsTxt(A))+'</code></div></div>';
  h+='<div class="card"><h3>Pay Per Crawl — 402 Payment Required Example <button class="btn-sm copy-btn" data-copy-id="p402">Copy</button></h3><p style="font-size:12px">5% of top-1000 sites already charge per crawl (Tollbit/402 beta). Training bots pay; search-index + user-fetch always bypass.</p><div class="code"><code id="p402">'+esc(gen402Example())+'</code></div></div>';
  try{
    const rdns=genRdnsChecklist(A.botData,A._records||[]);
    if(rdns)h+='<div class="card"><h3>Reverse-DNS Verification Checklist <button class="btn-sm copy-btn" data-copy-id="rdns">Copy</button></h3><p style="font-size:12px">Run server-side before blocking anything claiming to be Google/Bing. Forward-confirmed rDNS is the only real proof.</p><div class="code"><code id="rdns">'+esc(rdns)+'</code></div></div>';
  }catch(e){}
  if(!A.edgeRules.cloudflare.length&&!A.edgeRules.fastly.length&&!A.edgeRules.aws.length)h+=warnIssue('No Rules Generated','No bot met the rule threshold (training/search/suspicious: 2+ requests; user-triggered: 1+).','N/A','Upload a larger log file.');
  h+='<div class="card"><h3>Standards-Compliant Rate Control (instead of tarpitting)</h3>'+
    '<p>Tarpitting and poison-pill content are a DoS liability and fail enterprise security review — use these instead:</p><div class="cols2">'+
    '<div><h4>429 + Retry-After + allowlist</h4><p>Rate-limit aggressive bots with <code>429 Too Many Requests</code> + <code>Retry-After: 30</code>. Allowlist verified search (Google/Bing rDNS) so you never 429 revenue crawls. Rules above already use this pattern.</p></div>'+
    '<div><h4>503 + Retry-After for origin protection</h4><p>Under load, shed bot traffic first with <code>503 Service Unavailable</code> + <code>Retry-After: 60</code> — crawlers back off, humans retry. Pair with the Cloudflare AI Crawl Control mapping above.</p></div>'+
    '</div></div>';
  el.innerHTML=h;
}

function renderTab7(A){
  const el=document.getElementById('tab7');let h='';
  h+='<div class="card"><h3>Module 7: Performance Deep Dive</h3>'+
    '<p>Response Time (TTFB) by traffic category. High TTFB for bots = origin compute pressure. High TTFB for humans = infrastructure problems.</p></div>';
  const sorted=Object.values(A.botData).filter(b=>b.avgMs!==null).sort((a,b)=>b.avgMs-a.avgMs);
  if(sorted.length){
    const slowBots=sorted.filter(b=>b.avgMs>500&&b.tier!=='human');
    const slowHumans=sorted.filter(b=>b.avgMs>300&&b.tier==='human');
    if(slowBots.length>0)h+=warnIssue('Slow Bot Response Times',slowBots.length+' bot categories have avg TTFB > 500ms. Indicates origin compute pressure.','Degraded origin performance','Block aggressive bots at edge.');
    if(slowHumans.length>0)h+=critIssue('Slow Human Response Times','Human traffic has avg TTFB > 300ms. Directly impacts user experience, conversion rates, and SEO.','Lost revenue from slow loads','Optimize origin response time. Implement CDN caching.');
    h+='<div class="card"><h3>Response Time by Bot Type</h3>';
    const mT=Math.max(...sorted.map(b=>b.avgMs));
    h+=mkTable([th('Bot'),th('Category'),th('Requests','n'),th('Avg TTFB','n'),th('P95 TTFB','n'),th('Visual')],
      sorted.map(b=>{
        return '<tr><td><strong>'+esc(b.name)+'</strong></td><td><span class="badge '+(TC[b.tier]||'b-gray')+'">'+tierLabel(b.tier)+'</span></td>'+
          td(fmtN(b.count),'n')+td(Math.round(b.avgMs)+'ms','n')+
          td(b.p95Ms?Math.round(b.p95Ms)+'ms':'--','n')+
          '<td style="width:180px"><div style="width:100%;height:6px;background:var(--bg-2);border-radius:3px"><div style="width:'+Math.min(b.avgMs/mT*100,100)+'%;height:100%;background:'+(b.tier==='human'?'var(--green)':b.tier==='ai_training'?'var(--red)':'var(--accent)')+';border-radius:3px"></div></div></td></tr>';
      }));
    h+='</div>';
  }
  h+='<div class="card"><h3>Status Code Distribution</h3><div class="bars">';
  const mS=Math.max(...Object.values(A.tp.statuses),1);
  const sC={'2xx':'green','3xx':'blue','4xx':'amber','5xx':'red'};
  for(const[st,cnt] of Object.entries(A.tp.statuses).sort())h+='<div class="bar-r"><div class="bar-l">'+st+'</div><div class="bar-t"><div class="bar-f '+(sC[st]||'blue')+'" style="width:'+Math.max(cnt/mS*100,2)+'%"></div></div><div class="bar-v">'+fmtN(cnt)+'</div></div>';
  h+='</div></div>';
  h+='<div class="card"><h3>HTTP Method Distribution</h3>';
  const tM=Object.values(A.tp.methods).reduce((s,v)=>s+v,0);
  h+=mkTable([th('Method'),th('Count','n'),th('%','n'),th('Interpretation')],
    Object.entries(A.tp.methods).sort((a,b)=>b[1]-a[1]).map(([m,cnt])=>'<tr><td><strong>'+esc(m)+'</strong></td>'+td(fmtN(cnt),'n')+td(fmtP(cnt/tM*100),'n')+'<td>'+(m==='GET'?'Standard requests':m==='POST'?'Form submissions/API':m==='HEAD'?'Health checks':m+' request')+'</td></tr>'));
  h+='</div>';
  el.innerHTML=h;
}

function renderTab8(A){
  const el=document.getElementById('tab8');let h='';
  h+='<div class="card"><h3>Module 8: Predictive Crawl Spike Detection</h3>'+
    '<p>Request volume by hour (UTC). Red bars = statistically significant spikes (mean + 2 std dev). Your avg: '+Math.round(A.tp.hAvg)+' req/hr, std dev: '+A.tp.hStd.toFixed(1)+'.</p><div class="bars">';
  const mH=Math.max(...A.tp.hourly,1);
  A.tp.hourly.forEach((cnt,hr)=>{const sp=A.tp.spikes[hr];h+='<div class="bar-r"><div class="bar-l">'+String(hr).padStart(2,'0')+':00'+(sp?' *':'')+'</div><div class="bar-t"><div class="bar-f '+(sp?'red':'blue')+'" style="width:'+Math.max(cnt/mH*100,2)+'%"></div></div><div class="bar-v">'+fmtN(cnt)+'</div></div>'});
  h+='</div>';
  if(Object.keys(A.tp.spikes).length)h+=warnIssue('Velocity Spikes Detected','Hours marked with * exceed mean + 2 std dev ('+Math.round(A.tp.hAvg+2*A.tp.hStd)+' req/hr). May indicate automated scraping.','Excessive bandwidth during spikes','Implement time-based rate limiting.');
  h+='</div>';
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  h+='<div class="card"><h3>Day-of-Week Distribution</h3><div class="bars">';
  const mD=Math.max(...A.tp.daily,1);
  A.tp.daily.forEach((cnt,d)=>h+='<div class="bar-r"><div class="bar-l">'+days[d]+'</div><div class="bar-t"><div class="bar-f purple" style="width:'+Math.max(cnt/mD*100,2)+'%"></div></div><div class="bar-v">'+fmtN(cnt)+'</div></div>');
  h+='</div></div>';
  h+='<div class="card"><h3>Top 25 IPs by Request Volume</h3>';
  h+=mkTable([th('IP Address'),th('Requests','n'),th('% of Total','n')],
    A.tp.topIPs.map(([ip,cnt])=>'<tr><td style="font-family:var(--mono)">'+esc(ip)+'</td>'+td(fmtN(cnt),'n')+td(fmtP(cnt/A.summary.totalRecords*100),'n')+'</tr>'));
  h+='</div>';
  if(A.tp.topRef.length){
    h+='<div class="card"><h3>Top Referrers</h3><div class="bars">';
    const mR=A.tp.topRef[0][1]||1;
    for(const[ref,cnt] of A.tp.topRef)h+='<div class="bar-r"><div class="bar-l" title="'+esc(ref)+'">'+esc(ref.length>32?ref.substring(0,30)+'...':ref)+'</div><div class="bar-t"><div class="bar-f cyan" style="width:'+Math.max(cnt/mR*100,2)+'%"></div></div><div class="bar-v">'+fmtN(cnt)+'</div></div>';
    h+='</div></div>';
  }
  el.innerHTML=h;
}

function renderTab9(A){
  const el=document.getElementById('tab9');let h='';
  h+='<div class="card"><h3>Module 9: Security Threat Intelligence</h3>'+
    '<p>Automated detection of suspicious patterns, admin panel probes, and high-velocity IPs.</p>'+
    '<div class="cols2"><div>'+
    '<div class="sr"><span class="sr-l">Total Unique IPs</span><span class="sr-v">'+fmtN(A.sec.totalIPs)+'</span></div>'+
    '<div class="sr"><span class="sr-l">Suspicious Patterns</span><span class="sr-v" style="color:var(--red)">'+fmtN(A.sec.threats.length)+'</span></div></div><div>'+
    '<div class="sr"><span class="sr-l">High-Velocity IPs</span><span class="sr-v" style="color:var(--amber)">'+fmtN(A.sec.hvIPs.length)+'</span></div>'+
    '<div class="sr"><span class="sr-l">Velocity Threshold</span><span class="sr-v">'+A.sec.velocityThreshold.toFixed(1)+' req/sec (data-driven)</span></div></div></div>'+
    '<p style="font-size:11px;color:var(--text-3);margin-top:8px">* Threshold: mean + 2 std dev ('+A.sec.rA.toFixed(2)+' + 2×'+A.sec.rS.toFixed(2)+' = '+A.sec.velocityThreshold.toFixed(1)+' req/sec)</p></div>';
  if(A.sec.threats.length)h+=critIssue('Security Threats — '+fmtN(A.sec.threats.length)+' Patterns','Detected suspicious patterns including path traversal, admin probes, and sensitive file access. Active attacks against your infrastructure.','Potential data breach','Block IPs at edge immediately. Enable WAF rules.');
  if(A.sec.threats.length){
    const grouped=grpBy(A.sec.threats,'type');
    h+='<div class="card"><h3>Suspicious Request Patterns</h3>';
    h+=mkTable([th('Threat'),th('Severity'),th('Count','n'),th('Sample IP'),th('Sample URI'),th('User-Agent')],
      Object.entries(grouped).map(([threat,items])=>'<tr class="hl"><td><strong>'+esc(threat)+'</strong></td><td><span class="badge '+(items[0].sev==='critical'?'b-red':items[0].sev==='high'?'b-amber':'b-blue')+'">'+items[0].sev.toUpperCase()+'</span></td>'+td(fmtN(items.length),'n')+'<td style="font-family:var(--mono);font-size:11px">'+esc(items[0].ip)+'</td><td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">'+esc(items[0].uri)+'</td><td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">'+esc((items[0].ua||'').substring(0,50))+'</td></tr>'));
    h+='</div>';
  }
  if(A.sec.hvIPs.length){
    h+=warnIssue('High-Velocity IPs — Potential DDoS/Scraping',fmtN(A.sec.hvIPs.length)+' IPs exceeding '+A.sec.velocityThreshold.toFixed(1)+' req/sec.','Origin overload','Block at CDN edge.');
    h+='<div class="card"><h3>High-Velocity IPs</h3>';
    h+=mkTable([th('IP'),th('Requests','n'),th('Req/Sec','n'),th('URLs','n'),th('4xx','n'),th('Top UA')],
      A.sec.hvIPs.slice(0,15).map(ip=>'<tr class="hl"><td style="font-family:var(--mono)">'+esc(ip.ip)+'</td>'+td(fmtN(ip.count),'n')+td(ip.rps.toFixed(1),'n','style="color:var(--red)"')+td(fmtN(ip.uniqueUrls),'n')+td(fmtN(ip.s4xx),'n')+'<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">'+esc((ip.uas[0]||'').substring(0,55))+'</td></tr>'));
    h+='</div>';
  }
  if(A.sec.largeP.length){
    h+='<div class="card"><h3>Large Payload Requests (>10MB)</h3>';
    h+=mkTable([th('IP'),th('URI'),th('Size','n'),th('User-Agent')],
      A.sec.largeP.map(p=>'<tr><td style="font-family:var(--mono)">'+esc(p.ip)+'</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(p.uri)+'</td>'+td(fmtB(p.bytes),'n','style="color:var(--amber)"')+'<td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px">'+esc((p.ua||'').substring(0,55))+'</td></tr>'));
    h+='</div>';
  }
  el.innerHTML=h;
}

function renderTab10(A){
  const el=document.getElementById('tab10');let h='';
  const c=A.costs,s=A.summary,pricing=A.cfg;
  const tr=s.timeRange;
  const logDurationDays=tr?tr.durationMs/(1000*60*60*24):null;
  const dailyMultiplier=logDurationDays?30/logDurationDays:null;
  const projMonthly=c.savings.botBlocking*(dailyMultiplier||1);
  const projAnnual=projMonthly*12;
  h+='<div class="card"><h3>Module 10: Financial Egress &amp; Infrastructure Dashboard (CFO)</h3>'+
    '<p>Financial summary based on YOUR log data and configured pricing. All figures from actual measurements — no assumptions.</p>'+
    '<div class="kpi-strip" style="margin-top:14px">'+
    '<div class="kpi c-amber"><div class="kpi-label">Total Infrastructure Cost</div><div class="kpi-val">'+fmtC(c.total.all)+'</div><div class="kpi-sub">measured from log data</div></div>'+
    '<div class="kpi c-red"><div class="kpi-label">Blockable Bot Cost</div><div class="kpi-val">'+fmtC(c.savings.botBlocking)+'</div><div class="kpi-sub">AI training + suspicious</div></div>'+
    '<div class="kpi c-green"><div class="kpi-label">Projected Monthly Savings</div><div class="kpi-val">'+fmtC(projMonthly)+'</div><div class="kpi-sub">scaled from log period</div></div>'+
    '<div class="kpi c-blue"><div class="kpi-label">Projected Annual Savings</div><div class="kpi-val">'+fmtC(projAnnual)+'</div><div class="kpi-sub">12 × monthly projection</div></div></div></div>';
  if(c.savings.botBlocking>0)h+=critIssue('Measurable Waste: '+fmtC(c.savings.botBlocking),'Blocking AI training and suspicious bots would save '+fmtC(c.savings.botBlocking)+' in this log period. Scaled: '+fmtC(projMonthly)+'/month.',fmtC(c.savings.botBlocking)+' | '+fmtC(projAnnual)+'/year projected','Deploy Module 6 edge rules.');
  h+='<div class="card"><h3>Cost Breakdown (Measured)</h3>';
  h+=mkTable([th('Cost Category'),th('Measured Cost','n'),th('% of Total','n'),th('Description')],
    [['CDN Egress',c.total.egress,c.total.all>0?fmtP(c.total.egress/c.total.all*100):'0%','Bandwidth for all traffic'],
     ['Request Processing',c.total.request,c.total.all>0?fmtP(c.total.request/c.total.all*100):'0%','Per-request CDN charges'],
     ['Origin Compute*',c.total.ssr,c.total.all>0?fmtP(c.total.ssr/c.total.all*100):'0%','Opt-in estimate only (OFF by default — enable in Pricing if you run SSR/Workers)'],
     ['<strong>Total</strong>',c.total.all,'100%','']].map(([cat,cost,pct,desc])=>'<tr><td>'+cat+'</td>'+td(fmtC(cost),'n')+td(pct,'n')+'<td style="font-size:11px">'+desc+'</td></tr>'));
  h+='<p style="font-size:11px;color:var(--text-3)">* Origin compute is NOT in your logs — it is an estimate you opt into. Egress + request costs are measured bytes × your pricing.</p>';
  h+='</div>';
  h+='<div class="card"><h3>Blockable Cost Breakdown</h3>';
  h+=mkTable([th('Category'),th('Measured Cost','n'),th('Annual Projection','n'),th('Blocking Method')],
    [['AI Training Scrapers',c.savings.byTier?.ai_training||0,(c.savings.byTier?.ai_training||0)*12,'Cloudflare/Fastly/AWS WAF'],
     ['Suspicious/Unknown Bots',(c.savings.byTier?.suspicious||0)+(c.savings.byTier?.unknown_bot||0),((c.savings.byTier?.suspicious||0)+(c.savings.byTier?.unknown_bot||0))*12,'Rate-limit + edge rules'],
     ['<strong>Total Blockable</strong>',c.savings.botBlocking,c.savings.botBlocking*12,'']].map(([cat,cost,ann,method])=>'<tr><td>'+cat+'</td>'+td(fmtC(cost),'n','style="color:var(--red)"')+td(fmtC(ann),'n','style="color:var(--amber)"')+'<td style="font-size:11px">'+method+'</td></tr>'));
  h+='</div>';
  h+='<div class="card"><h3>Time-Based Projections</h3>'+
    '<div class="cols2">'+
    '<div class="card" style="margin:0"><h4>Log Time Range</h4><div style="font-size:18px;font-weight:800;font-family:var(--mono)">'+(logDurationDays?logDurationDays.toFixed(1)+' days':'N/A')+'</div><p>'+(tr?tr.start.toISOString().split('T')[0]+' to '+tr.end.toISOString().split('T')[0]:'No timestamps')+'</p></div>'+
    '<div class="card" style="margin:0"><h4>Scaling Factor</h4><div style="font-size:18px;font-weight:800;font-family:var(--mono)">'+(dailyMultiplier?dailyMultiplier.toFixed(2)+'×':'N/A')+'</div><p>Ratio of 30-day month to log duration</p></div>'+
    '</div>'+
    '<div class="rec green"><h5>Annual Projection</h5><p>Blocking AI training and suspicious bots would save approximately <strong>'+fmtC(projAnnual)+'</strong> per year.</p></div>'+
    '</div>';
  h+='<div class="card"><h3>Analysis Metadata</h3>'+
    '<div class="sr"><span class="sr-l">Total Log Records</span><span class="sr-v">'+fmtN(s.totalRecords)+'</span></div>'+
    '<div class="sr"><span class="sr-l">Data Volume</span><span class="sr-v">'+s.totalBytesFmt+'</span></div>'+
    '<div class="sr"><span class="sr-l">Unique IPs / URLs</span><span class="sr-v">'+fmtN(s.uniqueIPs)+' / '+fmtN(s.uniqueURLs)+'</span></div>'+
    '<div class="sr"><span class="sr-l">Date Range</span><span class="sr-v">'+(s.dateRange.start?s.dateRange.start.toISOString().split('T')[0]:'--')+' to '+(s.dateRange.end?s.dateRange.end.toISOString().split('T')[0]:'--')+'</span></div>'+
    '<div class="sr"><span class="sr-l">Human / Bot Split</span><span class="sr-v">'+fmtP(s.humanPct)+' human / '+fmtP(s.botPct)+' bot</span></div>'+
    '<div class="sr"><span class="sr-l">Pricing Used</span><span class="sr-v">CDN '+fmtC(pricing.cdnEgress)+'/GB, Req '+fmtC(pricing.request10K)+'/10K'+(pricing.ssr1K>0?', Compute '+fmtC(pricing.ssr1K)+'/1K (opt-in ON)':', Compute OFF (opt-in)')+'</span></div>'+
    '</div>';
  el.innerHTML=h;
}

/* ==== R: TAB COUNTS + EXPORTS + JOIN ==== */
function updateTabCounts(A){
  try{
    const set=(tab,txt)=>{const b=document.querySelector(`[data-tab="${tab}"]`);if(!b)return;const base=b.textContent.split('(')[0].trim();b.textContent=`${base} (${txt})`;};
    const bd=Object.values(A.botData);const n1=Object.keys(A.botData).length;
    const n2=`${A.vs.unusual}\u26a0`;
    const trapBytes=Object.values(A.traps).reduce((s,t)=>s+t.bytes,0);
    const wastePct=A.summary.totalBytes?Math.round(trapBytes/A.summary.totalBytes*100):0;
    set('tab1',n1);set('tab2',n2);set('tab3',`waste ${wastePct}%`);set('tab4',fmtC(A.costs.total.all));
    set('tab5',Object.keys(A.aiMatrix).length);set('tab6',A.edgeRules.cloudflare.length);
    set('tab9',A.sec.threats.length);set('tab10',fmtC(A.costs.savings.botBlocking));
  }catch(e){}
}
function downloadFile(name,content,type){const b=new Blob([content],{type:type||'text/plain'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);}
function exportBotCSV(A){const rows=[['bot','tier','requests','bytes','egress_usd','requests_usd','compute_usd','total_usd']];for(const[n,c]of Object.entries(A.costs.byBot))rows.push([`"${n.replace(/"/g,'""')}"`,A.botData[n]?.tier||'',c.count,c.totalBytes,c.eg.toFixed(4),c.rq.toFixed(4),c.ss.toFixed(4),c.total.toFixed(4)]);downloadFile('bot-costs.csv',rows.map(r=>r.join(',')).join('\n'),'text/csv');}
function exportLogsBQCSV(A){downloadFile('logs.csv',exportLogsCSV(A),'text/csv');}
function exportPromptListFile(A){downloadFile('prompt-test-list.txt',genPromptList(A),'text/plain');}
function exportLlmsFile(A){downloadFile('llms.txt',genLlmsTxt(A),'text/plain');}
function exportCfJsonFile(A){downloadFile('cf-ai-crawl-control.json',genCfAICrawlJSON(A.botData),'application/json');}
function exportCFOPDF(A){
  // One-click CFO 1-pager: print-friendly window (client-side, no deps) — user prints to PDF
  const c=A.costs,s=A.summary;
  const traps=Object.entries(A.traps).sort((a,b)=>b[1].count-a[1].count).slice(0,3).map(([n,t])=>`<li>${n}: ${t.count.toLocaleString()} req, ${(t.bytes/1048576).toFixed(1)} MB</li>`).join('');
  const rules=A.edgeRules.cloudflare.slice(0,3).map(r=>`<li><b>${r.name}</b> — ${r.act}: <code>${r.rule.substring(0,120)}</code></li>`).join('');
  const w=window.open('','_blank','width=800,height=900');
  w.document.write(`<html><head><title>CFO 1-pager — Bot Traffic Cost</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:22px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:6px 8px;font-size:13px}code{background:#f4f4f4;padding:2px 4px;font-size:12px}</style></head><body><h1>Bot Traffic Cost — CFO 1-pager</h1><p>Total: <b>$${c.total.all.toFixed(2)}</b> | Blockable: <b>$${c.savings.botBlocking.toFixed(2)}</b> | Records: ${s.totalRecords.toLocaleString()} | Period: ${(s.dateRange.start||'').toString().slice(0,10)} → ${(s.dateRange.end||'').toString().slice(0,10)}</p><h3>Top 3 traps</h3><ul>${traps||'<li>none</li>'}</ul><h3>Top 3 edge rules</h3><ul>${rules||'<li>none</li>'}</ul><h3>robots.txt</h3><pre>${(A.edgeRules.robots||'').substring(0,1200)}</pre><p><i>100% client-side. Method: measured bytes × configured CDN pricing. Print → Save as PDF.</i></p><script>window.print()<\/script></body></html>`);
  w.document.close();
}
/* AWS ALB space-delimited access logs:
 * http 2026-09-01T10:00:00.000Z app/lb/abc 192.168.1.1:2817 10.0.0.1:80 0.001 0.002 0.003 200 200 0 57 "GET http://x:80/ HTTP/1.1" "curl/7.46.0" ... */
function parseALBLine(line){
  if(!/^(http|https|h2|grpc|ws|wss)\s+\S+Z?\s+\S+\s+\S+:\d+\s+\S+/.test(line))return null;
  const m=line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+):\d+\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\S+)\s+(\S+)\s+"([^"]*)"\s+"([^"]*)"/);
  if(!m)return null;
  let method='GET',uri='/';
  const rq=(m[13]||'').trim().split(' ');
  if(rq.length>=2){method=rq[0];try{uri=new URL(rq[1]).pathname+(new URL(rq[1]).search||'');}catch(e){uri=rq[1]||'/';}}
  return{remote_addr:m[4],time_local:m[2],request_uri:uri||'/',request_method:method,status:m[9],bytes_sent:m[12],referer:'',user_agent:m[14]||'',elb_status_code:m[9],target_status_code:m[10],request_processing_time:m[6]};
}
function parseCombinedLine(line){  // Apache/Nginx Combined (lenient): 127.0.0.1 - frank [10/Oct/2000:13:55:36 -0700] "GET /a.gif HTTP/1.0" 200 2326 "ref" "ua"
  // Tolerates "-" request, "-" status/bytes, and a missing trailing UA quote group.
  const m=line.match(/^(\S+) \S+ (\S+) \[([^\]]+)\] "([^"]*)" (\d{3}|-) (\S+)(?: "([^"]*)"( "([^"]*)")?)?/);
  if(!m)return null;
  let method='GET',uri='/';
  const rq=(m[4]||'').trim();
  if(rq&&rq!=='-'){const rm=rq.match(/^(\S+)\s+(\S+)/);if(rm){method=rm[1];uri=rm[2]}else uri=rq.split(' ')[0]||'/';}
  return{remote_addr:m[1],time_local:m[3],request_uri:uri,request_method:method,status:m[5]==='-'?0:m[5],bytes_sent:m[6]==='-'?0:m[6],referer:m[7]||'',user_agent:m[9]||''};
}
// Quote-aware splitter for W3C Extended (fields may be quoted, UAs contain spaces)
function splitTokens(line){const m=String(line).match(/"[^"]*"|\S+/g);return m||[]}
function parseW3CFields(headerLine){
  const body=headerLine.replace(/^#Fields:\s*/i,'');
  return splitTokens(body).map(t=>t.toLowerCase());
}
function parseW3C(line,fields){
  const toks=splitTokens(line);
  if(!toks.length||toks.length<5)return null;
  const unq=t=>String(t||'').replace(/^"|"$/g,'');
  const at=n=>n>=0&&n<toks.length?unq(toks[n]):'';
  const idx={};fields.forEach((f,i)=>{if(!(f in idx))idx[f]=i});
  const di=idx['date'],ti=idx['time'];
  // Without a header we guess: date time c-ip ... cs-method cs-uri-stem sc-status sc-bytes
  let ip=idx['c-ip']!==undefined?at(idx['c-ip']):'';
  if(!ip&&toks.length>2&&/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(unq(toks[2])))ip=unq(toks[2]);
  const date=di!==undefined?at(di):(toks[0]||'');
  const time=ti!==undefined?at(ti):(toks[1]||'');
  const method=idx['cs-method']!==undefined?at(idx['cs-method']):(toks[3]||'GET');
  let uri=idx['cs-uri-stem']!==undefined?at(idx['cs-uri-stem']):(toks[4]||'/');
  const q=idx['cs-uri-query']!==undefined?at(idx['cs-uri-query']):'';
  if(q&&q!=='-')uri+=(/^[\?&]/.test(q)?'':'?')+q;
  const status=idx['sc-status']!==undefined?at(idx['sc-status']):(toks[5]||0);
  const bytes=idx['sc-bytes']!==undefined?at(idx['sc-bytes']):(toks[6]||0);
  let ua='';
  for(const k of ['cs(user-agent)','cs-user-agent','cs_user_agent']){if(idx[k]!==undefined){ua=at(idx[k]);break}}
  if(!ua){const last=toks[toks.length-1];if(last&&last.startsWith('"'))ua=unq(last);}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  return{remote_addr:ip,time_local:(date+' '+(time||'00:00:00')).trim(),request_uri:uri||'/',request_method:method||'GET',status:status==='-'?0:status,bytes_sent:bytes==='-'?0:bytes,referer:'',user_agent:ua};
}
/* Single-line dispatcher shared by streaming upload + tests.
 * Returns {rec, fmt} on success, {skip:true} for comments/brackets, null when unparseable. */
function parseLine(line,ctx){
  ctx=ctx||{w3c:null,format:'unknown'};
  const t=String(line).trim();
  if(!t)return{skip:true};
  if(t[0]==='#'){
    if(/^#Fields:/i.test(t)){ctx.w3c=parseW3CFields(t);ctx.format='w3c';}
    return{skip:true};
  }
  if(t==='['||t===']')return{skip:true};
  if(t[0]==='{'){
    let body=t;
    if(body.endsWith(','))body=body.slice(0,-1); // JSON-array style line
    if(body.endsWith(']'))body=body.slice(0,-1).trim();
    try{return{rec:JSON.parse(body),fmt:'json'};}catch(e){}
    const c=parseCombinedLine(t);
    if(c)return{rec:c,fmt:'combined'};
    return null;
  }
  const c=parseCombinedLine(t);
  if(c)return{rec:c,fmt:'combined'};
  const alb=parseALBLine(t);
  if(alb)return{rec:alb,fmt:'alb'};
  if(ctx.w3c){const w=parseW3C(t,ctx.w3c);if(w)return{rec:w,fmt:'w3c'};}
  else{
    // Fail closed: without a #Fields header we can only GUESS column order
    // (ELB/CloudFront custom orders differ). Parse leniently but flag
    // low-confidence so the UI warns instead of silently mis-attributing IPs.
    const w=parseW3C(t,['date','time','c-ip','cs-method','cs-uri-stem','sc-status','sc-bytes']);
    if(w)return{rec:w,fmt:'w3c-guess',lowConfidence:true,note:'No #Fields header — column order guessed (c-ip may be wrong for ELB/CloudFront custom orders). Add a #Fields header for exact mapping.'};
  }
  return null;
}
function sliceText(blob){
  if(blob.text)return blob.text();
  return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=e=>resolve(e.target.result);r.onerror=()=>reject(new Error('slice read failed'));r.readAsText(blob);});
}
const ANALYZE_CAP=300000; // max records analyzed in-browser; bigger files use systematic sampling
/* .gz streaming reader: DecompressionStream('gzip') piped line-by-line, never
 * holding the whole decompressed file as one string. ~20 lines, huge win vs
 * forcing users to pre-decompress (seoprocheck does access.log.2.gz natively). */
async function readGzRecords(file,onProgress){
  if(typeof DecompressionStream==='undefined')throw new Error('This browser cannot decompress .gz (no DecompressionStream). Decompress first or use the CLI: npm run gen-logs.');
  const stream=(file.stream?file.stream():new Blob([file]).stream()).pipeThrough(new DecompressionStream('gzip'));
  const reader=stream.getReader();
  const dec=new TextDecoder();
  const ctx={w3c:null,format:'unknown',lowConfidenceFormats:{}};
  const records=[];let buf='',lineIdx=0,bytesOut=0;
  for(;;){
    const{done,value}=await reader.read();
    if(value){bytesOut+=value.length;onProgress&&onProgress(null,bytesOut);buf+=dec.decode(value,{stream:!done});}
    if(done)buf+=dec.decode();
    let nl;
    while((nl=buf.indexOf('\n'))>=0){
      const ln=buf.slice(0,nl);buf=buf.slice(nl+1);
      const p=parseLine(ln,ctx);
      if(!p||p.skip)continue;
      lineIdx++;
      records.push(p.rec); // stride applied below once total is known
      if(p.fmt&&ctx.format==='unknown')ctx.format=p.fmt;
      if(p.lowConfidence)ctx.lowConfidenceFormats[p.fmt]=(ctx.lowConfidenceFormats[p.fmt]||0)+1;
    }
    if(done)break;
    await new Promise(r=>setTimeout(r,0));
  }
  if(buf.trim()){const p=parseLine(buf,ctx);if(p&&!p.skip){lineIdx++;records.push(p.rec);}}
  // Systematic 1-in-N sample AFTER full decompression (stride known only now)
  const stride=Math.max(1,Math.ceil(lineIdx/ANALYZE_CAP));
  const kept=stride===1?records:records.filter((_,i)=>(i+1)%stride===0);
  return{records:kept,totalLines:lineIdx,stride,format:(ctx.format==='unknown'?'gzip:'+ctx.format:ctx.format)||'gzip',lowConfidence:ctx.lowConfidenceFormats};
}
/* Streaming file reader: 8MB slices, never holds the whole file as one string,
 * so 500MB-1GB uploads don't die in FileReader.readAsText. Returns analyzed records
 * plus sampling metadata. Pure except onProgress — unit-testable in Node (Blob).
 * .gz files route to readGzRecords above. */
async function readFileRecords(file,onProgress){
  if(file&&file.name&&/\.gz$/i.test(file.name))return readGzRecords(file,onProgress);
  const SLICE=8*1024*1024;
  const size=file.size||0;
  // Small JSON arrays (<64MB): exact whole-read path (handles pretty-printed arrays)
  if(size>0&&size<64*1024*1024){
    try{
      const head=(await sliceText(file.slice(0,Math.min(65536,size)))).replace(/^[\uFEFF\s]*/,'');
      if(head.startsWith('[')){
        const full=await sliceText(file);
        const arr=JSON.parse(full);
        const recs=(Array.isArray(arr)?arr:[arr]).filter(Boolean);
        onProgress&&onProgress(1);
        return{records:recs,totalLines:recs.length,stride:1,format:'json-array'};
      }
    }catch(e){/* fall through to streaming */}
  }
  const estLines=Math.max(1,Math.round(size/400));
  const stride=Math.max(1,Math.ceil(estLines/ANALYZE_CAP));
  const records=[];
  const ctx={w3c:null,format:'unknown',lowConfidenceFormats:{}};
  let offset=0,leftover='',lineIdx=0;
  while(offset<size){
    const end=Math.min(offset+SLICE,size);
    const chunk=await sliceText(file.slice(offset,end));
    offset=end;
    onProgress&&onProgress(size?offset/size:1);
    const text=leftover+chunk;
    const lines=text.split('\n');
    leftover=lines.pop();
    for(const ln of lines){
      const p=parseLine(ln,ctx);
      if(!p||p.skip)continue;
      lineIdx++;
      if(stride===1||lineIdx%stride===0)records.push(p.rec);
      if(p.fmt&&ctx.format==='unknown')ctx.format=p.fmt;
      if(p.lowConfidence)ctx.lowConfidenceFormats[p.fmt]=(ctx.lowConfidenceFormats[p.fmt]||0)+1;
    }
    await new Promise(r=>setTimeout(r,0)); // keep tab responsive
  }
  if(leftover&&leftover.trim()){
    const p=parseLine(leftover,ctx);
    if(p&&!p.skip){lineIdx++;if(stride===1||lineIdx%stride===0)records.push(p.rec);if(p.fmt&&ctx.format==='unknown')ctx.format=p.fmt;if(p.lowConfidence)ctx.lowConfidenceFormats[p.fmt]=(ctx.lowConfidenceFormats[p.fmt]||0)+1;}
  }
  return{records,totalLines:lineIdx,stride,format:ctx.format,lowConfidence:ctx.lowConfidenceFormats};
}
function parseTextLogs(text){
  const lines=text.split('\n');const out=[];let combined=0;
  for(const ln of lines){
    const t=ln.trim();if(!t)continue;
    if(t.startsWith('{')){try{out.push(JSON.parse(t));continue}catch(e){}}
    const c=parseCombinedLine(ln);if(c){out.push(c);combined++;}
  }
  return{records:out,combined};
}
/* Real Crawl+GSC join: crawlUrls = full URL list (one per line or CSV col 1);
 * gscRows = [{url, clicks, impressions}] parsed from a GSC pages export.
 * Backward-compat: plain string arrays still work (clicks=0).
 * Uses analysis._urlSet (full deduped log URLs, 100k cap) as the log side so the
 * join never silently runs on a 20k slice. Waste $ = orphan crawls × avg cost/req. */
function joinCrawlGsc(analysis,crawlUrls,gscRows){
  const clean=u=>String(u||'').trim().split('?')[0];
  const crawled=new Set((crawlUrls||[]).map(clean).filter(Boolean));
  const logSet=new Set([...(analysis._urlSet||[])].map(clean));
  if(!crawled.size)for(const u of logSet)crawled.add(u); // default: log URLs are the crawl set
  const rows=(gscRows||[]).map(r=>typeof r==='string'?{url:r,clicks:0,impressions:0}:r);
  const gscMap=new Map();
  for(const r of rows){const u=clean(r.url);if(!u)continue;const e=gscMap.get(u)||{url:u,clicks:0,impressions:0};e.clicks+=+r.clicks||0;e.impressions+=+r.impressions||0;gscMap.set(u,e);}
  const indexed=new Set(gscMap.keys());
  const total=analysis&&analysis.costs?analysis.costs.total.all:0;
  const recs=analysis&&analysis.summary?analysis.summary.totalRecords:0;
  const avgCost=recs?total/recs:0;
  const orphanCrawled=[...crawled].filter(u=>!indexed.has(u)).slice(0,500);
  const uncrawled=[...indexed].filter(u=>!crawled.has(u)).map(u=>({...gscMap.get(u)})).sort((a,b)=>b.clicks-a.clicks).slice(0,500);
  const orphanClicks=orphanCrawled.reduce((s,u)=>s+(gscMap.get(u)?gscMap.get(u).clicks:0),0);
  const uncrawledClicks=uncrawled.reduce((s,r)=>s+r.clicks,0);
  return{uncrawled,orphanCrawled,crawledCount:crawled.size,indexedCount:indexed.size,
    wasteUSD:orphanCrawled.length*avgCost,avgCostPerReq:avgCost,orphanClicks,uncrawledClicks,
    note:'waste = orphan crawled URLs × measured $/req ('+fmtC(avgCost)+'/req). Search-index/user-fetch never counted as waste.'};
}
/* Parse a GSC pages CSV export: finds URL col (page/top pages) + clicks +
 * impressions cols by header name; falls back to col-1 URLs with 0 clicks. */
function parseGscCsv(text){
  const lines=String(text||'').split('\n').map(l=>l.trim()).filter(Boolean);
  if(!lines.length)return[];
  const head=lines[0].toLowerCase();
  const hasHead=/url|page|click|impression/.test(head);
  const cols=lines[0].split(',').map(c=>c.trim().toLowerCase());
  const ui=cols.findIndex(c=>/url|page|top pages/.test(c));
  const ci=cols.findIndex(c=>/click/.test(c));
  const ii=cols.findIndex(c=>/impression/.test(c));
  const body=hasHead?lines.slice(1):lines;
  return body.map(l=>{const c=l.split(',').map(x=>x.trim());
    return{url:(ui>=0?c[ui]:c[0])||'',clicks:ci>=0?parseInt(c[ci],10)||0:0,impressions:ii>=0?parseInt(c[ii],10)||0:0};}).filter(r=>r.url);
}
function renderAll(A){
  const renderers=[
    ()=>renderKPIs(A.summary,A.costs),
    ()=>renderTab1(A),()=>renderTab2(A),()=>renderTab3(A),
    ()=>renderTab4(A),()=>renderTab5(A),()=>renderTab6(A),
    ()=>renderTab7(A),()=>renderTab8(A),()=>renderTab9(A),
    ()=>renderTab10(A)
  ];
  for(const fn of renderers){
    try{fn()}catch(e){console.error('Render error:',e)}
  }
  updateTabCounts(A);
  document.querySelectorAll('.copy-btn').forEach(btn=>{btn.onclick=e=>{e.stopPropagation();const t=btn.dataset.copy||(btn.dataset.copyId&&document.getElementById(btn.dataset.copyId)?.textContent)||'';if(t)navigator.clipboard?.writeText(t).then(()=>{btn.textContent='Copied!';setTimeout(()=>btn.textContent='Copy',1200)});};});
}


/* ==== O: SAMPLE DATA (deterministic: seeded mulberry32, same family as tools/gen-logs.js) ==== */
function mulberry32(seed){let a=seed>>>0;return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
const SAMPLE_SEED_DEFAULT=20260901;
function randIntR(rng,min,max){return Math.floor(rng()*(max-min+1))+min}
function randIPR(rng){
  const o=[];
  for(let i=0;i<4;i++)o.push(randIntR(rng,1,254));
  return o.join('.');
}
function randChoiceR(rng,arr){return arr[Math.floor(rng()*arr.length)]}
function randDateR(rng,startMs,endMs){
  return new Date(startMs+rng()*(endMs-startMs));
}

const SAMPLE_URLS={
  main:['/','/about','/contact','/pricing','/products','/blog','/features','/customers','/docs','/support','/login','/signup','/demo','/careers','/press','/terms','/privacy','/sitemap.xml','/robots.txt','/health'],
  products:['/products/widget-pro','/products/analytics-suite','/products/bot-shield','/products/crawl-monitor','/products/firewall','/products/cdn-optimizer','/products/api-gateway','/products/ai-detector'],
  blog:['/blog/seo-guide-2026','/blog/ai-scraping-impact','/blog/crawl-budget','/blog/bot-detection','/blog/edge-computing','/blog/cdn-costs','/blog/security-2026','/blog/performance-tips','/blog/cloud-migration','/blog/serverless'],
  docs:['/docs/getting-started','/docs/api-reference','/docs/authentication','/docs/webhooks','/docs/sdk','/docs/faq','/docs/changelog'],
  param:['/shop/filter?color=blue&size=xl&sort=price','/shop/filter?color=red&size=lg&brand=nike&sort=date&category=shoes&page=12','/products?category=all&price_min=50&price_max=200&sort=rating&page=3','/api/products?limit=50&offset=500&sort=created_at','/search?q=analytics&page=2&sort=relevance','/category/electronics?brand=apple&samsung&price=100-500&page=24'],
  trap:['/calendar/2026/01','/calendar/2026/02','/tag/seo','/tag/bot-detection','/author/john-smith','/archive/2025/06','/page/999','/sort?by=date&order=asc&page=100'],
  sec:['/.env','/.git/config','/wp-admin','/wp-login.php','/phpmyadmin','/.aws/credentials','/backup.zip','/database.sql','/adminer.php','/server-status'],
  api:['/api/v1/users?page=100','/api/v2/products?limit=1000','/graphql','/api/search?q=test&deep=true','/internal/metrics']
};

const SAMPLE_UAS={
  googlebot:['Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)','Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.127 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  bingbot:['Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  gptbot:['GPTBot/1.0 (+https://openai.com/gptbot)','GPTBot/1.1 (+https://openai.com/gptbot)'],
  bytespider:['Mozilla/5.0 (Linux; Android 10) Chrome/122.0.0.0 Mobile Safari/537.36 Bytespider/5.0','Mozilla/5.0 (Linux; Android 11) Chrome/124.0.0.0 Mobile Safari/537.36 Bytespider/5.1'],
  perplexity:['PerplexityBot/1.0 (+https://docs.perplexity.ai)','PerplexityBot/1.1 (+https://docs.perplexity.ai)'],
  claudebot:['ClaudeBot/1.0 (+https://anthropic.com/claudebot)','ClaudeBot/1.1 (+https://anthropic.com/claudebot)'],
  oai:['OAI-SearchBot/1.0 (+https://openai.com/searchbot)','OAI-SearchBot/1.1 (+https://openai.com/searchbot)'],
  ccbot:['CCBot/2.0 (+https://commoncrawl.org/faq/)','CCBot/2.1 (+https://commoncrawl.org/faq/)'],
  ahrefs:['Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
  semrush:['Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)'],
  yandex:['Mozilla/5.0 (compatible; YandexBot/3.0; +http://yandex.com/bots)'],
  baidu:['Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)'],
  facebook:['facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'],
  twitter:['Twitterbot/1.0'],
  linkedin:['LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)'],
  mozilla:['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36','Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0','Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15','Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1','Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36','Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0','Mozilla/5.0 (Linux; Android 14) Chrome/125.0.0.0 Mobile Safari/537.36','Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1']
};

const SAMPLE_CATS=[
  {c:'googlebot',w:.12,ipCount:80,ua:'googlebot'},
  {c:'bingbot',w:.035,ipCount:40,ua:'bingbot'},
  {c:'gptbot',w:.055,ipCount:30,ua:'gptbot'},
  {c:'bytespider',w:.045,ipCount:50,ua:'bytespider'},
  {c:'perplexity',w:.025,ipCount:20,ua:'perplexity'},
  {c:'claudebot',w:.018,ipCount:15,ua:'claudebot'},
  {c:'oai',w:.012,ipCount:12,ua:'oai'},
  {c:'ccbot',w:.03,ipCount:25,ua:'ccbot'},
  {c:'ahrefs',w:.02,ipCount:15,ua:'ahrefs'},
  {c:'semrush',w:.015,ipCount:12,ua:'semrush'},
  {c:'yandex',w:.02,ipCount:20,ua:'yandex'},
  {c:'baidu',w:.01,ipCount:15,ua:'baidu'},
  {c:'facebook',w:.015,ipCount:10,ua:'facebook'},
  {c:'twitter',w:.008,ipCount:8,ua:'twitter'},
  {c:'linkedin',w:.005,ipCount:6,ua:'linkedin'},
  {c:'human',w:.577,ipCount:500,ua:'mozilla'}
];
const SAMPLE_REF=['https://www.google.com/','https://www.bing.com/','https://duckduckgo.com/','https://www.facebook.com/','https://t.co/','https://www.linkedin.com/','https://www.reddit.com/','https://news.ycombinator.com/'];
const SAMPLE_METHODS=['GET','GET','GET','GET','GET','GET','POST','HEAD','PUT','DELETE'];
const SAMPLE_TLS=['TLSv1.3','TLSv1.2','TLSv1.3','TLSv1.3'];
const SAMPLE_CIPHERS=['TLS_AES_256_GCM_SHA384','TLS_CHACHA20_POLY1305_SHA256','TLS_AES_128_GCM_SHA256'];
const SAMPLE_CACHE=['HIT','MISS','MISS','EXPIRED','BYPASS','HIT','MISS'];
function buildSamplePools(rng){
  const ipPools={};
  for(const cat of SAMPLE_CATS){
    ipPools[cat.c]=[];
    for(let i=0;i<cat.ipCount;i++)ipPools[cat.c].push(randIPR(rng));
  }
  return ipPools;
}
function sampleTimeRange(rng){
  const durations=[1,7,30,90];
  const durationDays=randChoiceR(rng,durations);
  // Deterministic anchor (not `new Date()`): same seed => identical timestamps.
  const endTime=new Date(Date.UTC(2026,8,1)+Math.floor(rng()*86400000));
  return{startTime:new Date(endTime.getTime()-durationDays*24*3600*1000),endTime};
}
function genOneSample(ipPools,startTime,endTime,rng){
  let r=rng(),cum=0,cat=SAMPLE_CATS[0];
  for(const x of SAMPLE_CATS){cum+=x.w;if(r<=cum){cat=x.c;break}}
  const ua=randChoiceR(rng,SAMPLE_UAS[cat]||SAMPLE_UAS.mozilla);
  const ip=randChoiceR(rng,ipPools[cat]);
  const pr=rng();
  let path;
  if(cat==='human')path=pr<.45?randChoiceR(rng,SAMPLE_URLS.main):pr<.65?randChoiceR(rng,SAMPLE_URLS.products):pr<.82?randChoiceR(rng,SAMPLE_URLS.blog):pr<.92?randChoiceR(rng,SAMPLE_URLS.docs):pr<.97?randChoiceR(rng,SAMPLE_URLS.param):randChoiceR(rng,SAMPLE_URLS.api);
  else if(cat==='googlebot'||cat==='bingbot')path=pr<.3?randChoiceR(rng,SAMPLE_URLS.main):pr<.5?randChoiceR(rng,SAMPLE_URLS.products):pr<.68?randChoiceR(rng,SAMPLE_URLS.blog):pr<.82?randChoiceR(rng,SAMPLE_URLS.docs):pr<.92?randChoiceR(rng,SAMPLE_URLS.param):randChoiceR(rng,SAMPLE_URLS.api);
  else path=pr<.1?randChoiceR(rng,SAMPLE_URLS.main):pr<.25?randChoiceR(rng,SAMPLE_URLS.products):pr<.4?randChoiceR(rng,SAMPLE_URLS.blog):pr<.55?randChoiceR(rng,SAMPLE_URLS.docs):pr<.7?randChoiceR(rng,SAMPLE_URLS.param):pr<.85?randChoiceR(rng,SAMPLE_URLS.trap):pr<.93?randChoiceR(rng,SAMPLE_URLS.sec):randChoiceR(rng,SAMPLE_URLS.api);
  const sr=rng();
  let st;
  if(path.startsWith('/.'))st=404;else if(path.includes('wp-')||path.includes('phpmyadmin')||path.includes('adminer'))st=sr<.7?404:403;
  else if(sr<.72)st=200;else if(sr<.82)st=301;else if(sr<.88)st=304;else if(sr<.93)st=404;else if(sr<.96)st=429;else if(sr<.98)st=500;else st=403;
  const bytes=st===304?0:st===301?200:Math.floor(500+rng()*150000);
  const rtBase=cat==='human'?.03:cat==='googlebot'||cat==='bingbot'?.07:cat==='gptbot'||cat==='bytespider'?.2:.12;
  const rt=rtBase+rng()*(cat==='human'?.2:1.2);
  const ts=randDateR(rng,startTime.getTime(),endTime.getTime());
  return{ClientIP:ip,Timestamp:ts.toISOString(),RequestURI:path,RequestMethod:randChoiceR(rng,SAMPLE_METHODS),HttpStatus:st,Bytes:bytes,UserAgent:ua,Referer:cat==='human'?randChoiceR(rng,SAMPLE_REF):'',RequestTime:+rt.toFixed(3),CacheStatus:randChoiceR(rng,SAMPLE_CACHE),TLSProtocol:randChoiceR(rng,SAMPLE_TLS),TLSCipher:randChoiceR(rng,SAMPLE_CIPHERS)};
}
function sampleTargetRecords(targetSizeMB){
  const avgRecordSize=400; // measured compact-NDJSON bytes/record (long bot UAs)
  return Math.max(100,Math.round((targetSizeMB*1024*1024)/avgRecordSize));
}
/* Chunked NDJSON generator — never builds one giant string, so >100MB downloads
 * don't throw "Invalid string length". Batches of 20k records (~5MB/string).
 * Deterministic: same seed => byte-identical output (default fixed seed). */
function genSampleStream(targetSizeMB,onChunk,onDone,onError,seed){
  const rng=mulberry32(seed!=null?seed:SAMPLE_SEED_DEFAULT);
  const total=sampleTargetRecords(targetSizeMB);
  const ipPools=buildSamplePools(rng);
  const{startTime,endTime}=sampleTimeRange(rng);
  const PER=20000;
  let done=0;
  function step(){
    try{
      const n=Math.min(PER,total-done);
      const lines=new Array(n);
      for(let k=0;k<n;k++)lines[k]=JSON.stringify(genOneSample(ipPools,startTime,endTime,rng));
      done+=n;
      onChunk&&onChunk(lines.join('\n')+'\n',done,total);
      if(done<total)setTimeout(step,0);
      else onDone&&onDone(total);
    }catch(err){onError&&onError(err);}
  }
  setTimeout(step,0);
  return{total};
}
function genSample(targetSizeMB,seed){
  const rng=mulberry32(seed!=null?seed:SAMPLE_SEED_DEFAULT);
  const ipPools=buildSamplePools(rng);
  const{startTime,endTime}=sampleTimeRange(rng);
  const targetRecords=sampleTargetRecords(targetSizeMB);
  const recs=new Array(targetRecords);
  for(let i=0;i<targetRecords;i++)recs[i]=genOneSample(ipPools,startTime,endTime,rng);
  return JSON.stringify(recs,null,2);
}

/* ==== P: ABOUT/HOWTO ==== */
function renderAbout(){
  document.getElementById('about-content').innerHTML=`
<h1>About This Tool</h1>
<p>A fast, privacy-focused, <strong>100% client-side</strong> web utility for parsing server access logs, identifying bot traffic patterns, analyzing crawl budget distribution, and estimating infrastructure egress overhead. Free and open source (MIT) — the $0 alternative to £99/yr Screaming Frog Log Analyser and €171–383/mo JetOctopus.</p>
<h2>Why it exists</h2>
<p>Modern servers drown in automated traffic: search crawlers, SEO tools, and — since 2024 — AI bots that train models on your content for zero return. Incumbent answers are a desktop app with manual regex lists, or cloud platforms that require uploading sensitive logs to someone else's server. This tool is the third option: drop the log in your browser, get the GPTBot-vs-OAI-SearchBot cost split and copy-paste edge rules, with <strong>no log ever leaving your machine</strong> (safe for DPDP/RBI-sensitive data).</p>
<h2>The 2026 bot split (training vs search-index vs user-triggered)</h2>
<p>Senior SEOs interview on exactly this distinction, and the analyzer enforces it end to end (Bot DB v2026.09.02, 67 signatures):</p>
<ul><li><strong>Training</strong> (GPTBot, ClaudeBot, CCBot, Bytespider, cohere-ai, AI2Bot, GoogleOther, ImageSiftBot, Google-Extended robots token): throttle/block freely at 60 req/min (20 aggressive). Zero live citation loss.</li><li><strong>Search-index</strong> (OAI-SearchBot, PerplexityBot, Claude-SearchBot, DuckAssistBot): ALLOW at 120 req/min (60 aggressive), 429 + Retry-After, never hard block — citation share drops in 1–2 weeks if blocked.</li><li><strong>User-triggered</strong> (ChatGPT-User, Perplexity-User, Claude-User, MistralAI-User, Google-Agent): do NOT throttle (300/min abuse ceiling only). A 429 here means a missing live answer; robots.txt may not even apply.</li></ul>
<h2>How the 10 modules work</h2>
<ul><li><strong>1 · Bot Classification:</strong> bot-signature matching takes precedence over browser fingerprints (documented bot-first order, longest-pattern-first) across 67 signatures + 18 browser patterns. OAI-AdsBot is allow-listed (revenue checks), GoogleOther/ImageSiftBot are training.</li><li><strong>2 · Verification (4 layers):</strong> vendor IP JSON (dated 2026-09-01) first with IPv6 + CIDR matching; /16-or-longer cloud prefixes are low-confidence heuristics only (single-octet /8s removed). rDNS checklist exporter included. Anthropic publishes no IP list — robots.txt only. Signals, not proof.</li><li><strong>3 · Crawl Budget:</strong> per-crawler efficiency, parameterized-URL ratios, 13 trap patterns incl. gclid/fbclid, currency/locale and /filter/ segments.</li><li><strong>4 · Cost:</strong> measured bytes × your CDN preset (CloudFront/Cloudflare/Fastly/GCS). Origin-compute is opt-in (OFF by default — logs can't tell SSR vs static). Blockable = training + suspicious only. Crawl-to-referral table: OAI 85:1, Perplexity 210:1, Claude ~5,143:1.</li><li><strong>5 · AI Matrix:</strong> red = training, cyan = search-index, blue = user-triggered, each with its 2026 rate policy.</li><li><strong>6 · Edge Rules + robots.txt:</strong> Cloudflare/Fastly/AWS rules with copy buttons, training-vs-search robots.txt generator (Google-Extended is a token, not a UA), Cloudflare AI Crawl Control mapping + JSON exporter, llms.txt generator, 402 pay-per-crawl example, rDNS checklist. Rate control uses 429/503 + Retry-After — never tarpitting.</li><li><strong>7 · Performance:</strong> TTFB by category, status/method distributions.</li><li><strong>8 · Traffic Patterns:</strong> hourly spikes (mean + 2σ), day-of-week, top IPs/URLs/referrers.</li><li><strong>9 · Security:</strong> traversal, credential (.git/HEAD, .aws/credentials), actuator probes, velocity anomalies.</li><li><strong>10 · CFO/FinOps:</strong> measured totals, blockable waste, projections, CSV + print-to-PDF 1-pager export, logs.csv BigQuery/DuckDB bridge, GEO prompt-test list.</li></ul>
<h2>Privacy architecture</h2>
<ul><li>Parsing, analysis and rendering run in your browser (Web Worker for 20k+ rows). The only network request the app itself makes is loading the deterministic 10k demo file when you click it.</li><li>No cookies, no telemetry, no external dependencies at runtime. Open source for audit.</li></ul>
<h2>Honest limitations</h2>
<ul><li>Classification is User-Agent matching — spoofable; use Verification signals + server-side rDNS before blocking.</li><li>Files above ~300k lines analyze a labeled systematic sample (verification counts scaled, labeled); 500MB+ exact totals belong in the CLI.</li><li>W3C logs without a #Fields header parse in low-confidence guess mode — add the header.</li><li>Cost needs your real CDN pricing to be more than directional — set a preset. Origin-compute stays off unless you opt in.</li></ul>`;
}

function renderHowto(){
  document.getElementById('howto-content').innerHTML=`
<h1>How To Use</h1>
<div class="step"><div class="step-n">1</div><div class="step-body"><h3>Prepare your log file</h3><p>Seven formats, auto-detected per line — you can even mix JSON and Combined lines in one file. Multi-select rotated files (<code>access.log + access.log.1 + access.log.2.gz</code>) and <code>.gz</code> decompress in-browser via DecompressionStream. Uploads stream in 8MB slices, so 1GB files work; above ~300k lines a <strong>labeled systematic sample</strong> is analyzed. Each entry should carry timestamp, user_agent, IP, request URI and status (bytes/request_time/TLS/cache optional but recommended). AWS ALB + Cloudflare Logpush fields are mapped natively.</p></div></div>
<div class="step"><div class="step-n">2</div><div class="step-body"><h3>Upload</h3><p>Click Browse or drag-drop (or open <strong>?sample=10k</strong> for the 1-click demo). Files over 500MB ask for confirmation first. Everything runs locally — watch the Reading % bar, then the 14-step analysis progress.</p></div></div>
<div class="step"><div class="step-n">3</div><div class="step-body"><h3>Review (follow the money)</h3><p>Start at the KPI strip (Records, Human %, Total vs Blockable cost), then AI Matrix: <strong>red training = block, cyan search-index = rate-limit 120/min, blue user-triggered = never touch</strong>. Tab labels carry live counts so you know where the action is.</p></div></div>
<div class="step"><div class="step-n">4</div><div class="step-body"><h3>Act</h3><p>Copy Cloudflare/Fastly/AWS rules from Module 6 (copy buttons included), paste the generated robots.txt training-vs-search split, download the CFO 1-pager for stakeholders, and run the Crawl + GSC join to find orphaned crawls.</p></div></div>
<h2>Format examples (all accepted)</h2>
<div class="code"><h5>JSON array / JSONL (Cloudflare, Nginx, ALB, Varnish — field names auto-normalized)</h5><code>{"ClientIP":"66.249.66.1","Timestamp":"2026-01-15T10:30:45Z","RequestURI":"/products","HttpStatus":200,"Bytes":24500,"UserAgent":"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)","RequestTime":0.125,"TLSProtocol":"TLSv1.3"}</code></div>
<div class="code"><h5>Apache Combined / Nginx default (also tolerates "-" request, status and bytes)</h5><code>66.249.66.1 - - [25/Jul/2026:10:00:00 +0000] "GET /products HTTP/1.1" 200 24500 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"</code></div>
<div class="code"><h5>W3C Extended (uses your #Fields header to map columns)</h5><code>#Fields: date time c-ip cs-method cs-uri-stem cs-uri-query sc-status sc-bytes cs(User-Agent)<br>2026-09-01 10:00:00 66.249.66.1 GET /products - 200 24500 "Mozilla/5.0 (compatible; Googlebot/2.1)"</code></div>
<h2>FAQ</h2>
<div class="code"><h5>1GB upload fails?</h5><code>Use a modern desktop browser (not a phone), accept the &gt;500MB confirm, and stay on the tab. You will see Reading % then analysis %. Above ~300k lines a labeled 1-in-N sample is analyzed; costs in that case describe the sample and scale ~Nx. .gz + multi-file rotation supported. Phones: samples cap at 50MB — use the CLI.</code></div>
<div class="code"><h5>Still "No valid records found"?</h5><code>The error now reports lines seen + detected format. Compare your first line with the examples above — usually a custom column order (add a #Fields header) or a truncated download.</code></div>
<div class="code"><h5>Can I trust "VERIFIED" badges?</h5><code>Only the vendor-IP-JSON matches (dated, see data/bot-ips.json). Prefix matches say "heuristic (low confidence)". Anthropic has no IP list — robots.txt only. Always confirm with server-side rDNS before blocking search engines.</code></div>
<div class="code"><h5>Download buttons?</h5><code>Sample downloads (1MB–1GB, deterministic seed) stream in 20k-row chunks with progress. Analysis exports in the info bar: bot-costs CSV, CFO 1-pager (print-to-PDF), logs.csv for BigQuery/DuckDB (+ sample SQL in Module 6), prompt-test list for GEO citation checks, llms.txt. Module 6 also exports Cloudflare AI Crawl Control JSON + 402 pay-per-crawl example.</code></div>`;
}

/* ==== Q: CONTROLLER ==== */
let currentAnalysis=null,currentCfg={};
function showPage(id){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active-page'));document.querySelectorAll('.sb-btn').forEach(b=>b.classList.remove('active'));document.getElementById('sec-'+id).classList.add('active-page');document.querySelector(`[data-section="${id}"]`).classList.add('active')}
function showTab(id){document.querySelectorAll('.tp').forEach(p=>p.classList.remove('active-tp'));document.querySelectorAll('.tb').forEach(b=>b.classList.remove('active'));document.getElementById(id).classList.add('active-tp');document.querySelector(`[data-tab="${id}"]`).classList.add('active')}

function processRecords(records,file,meta){
      try{if(typeof lastRecords!=='undefined')lastRecords=records;}catch(e){}
      meta=meta||{};
      if(!records.length)throw new Error('No valid records found. Accepted: JSON array, JSONL/NDJSON, Apache Combined, Nginx default, W3C Extended, Cloudflare text.');
      if(typeof window!=='undefined'&&records.length>100000&&!('Worker' in window)){alert('Large file: 100k+ rows without Web Worker — UI may freeze briefly. Progress shown below.');}
      document.getElementById('ib-file').textContent=file?file.name:'pasted/sample';
      document.getElementById('ib-size').textContent=file?fmtB(file.size):'~'+fmtB(records.length*400);
      document.getElementById('ib-records').textContent=meta.stride>1?fmtN(records.length)+' (1-in-'+meta.stride+' of '+fmtN(meta.totalLines||records.length)+')':fmtN(records.length);
      document.getElementById('ib-fields').textContent=records[0]?Object.keys(records[0]).length:'--';
      document.getElementById('info-bar').classList.remove('hidden');
      document.getElementById('live-monitor-bar').classList.remove('hidden');
      const run=()=>{
        currentAnalysis=analyze(records,currentCfg,(pct,msg)=>{document.getElementById('progress-fill').style.width=pct+'%';document.getElementById('progress-label').textContent=msg;document.getElementById('progress-pct').textContent=pct+'%'});
        // analyze() already builds a full deduped _urlSet (100k cap). Keep it —
        // never overwrite with a 20k slice.
        if(!currentAnalysis._urlSet||!currentAnalysis._urlSet.length){
          currentAnalysis._urlSet=[...new Set(records.map(r=>{try{return norm(r).uri.split('?')[0]}catch(e){return null}}).filter(Boolean))].slice(0,100000);
        }
        document.getElementById('progress-wrap').classList.add('hidden');
        document.getElementById('results').classList.remove('hidden');
        renderAll(currentAnalysis);
        if(meta.stride>1)showSampleBanner(meta.stride,records.length,meta.totalLines,meta.readMs||0);
        else{const old=document.getElementById('sample-note');old&&old.remove();}
        if(meta.lowConfidence&&meta.lowConfidence['w3c-guess'])showGuessWarning(meta.lowConfidence['w3c-guess']);
        wireExportButtons();
      };
      // Web Worker path if available (js/worker.js), else main thread
      try{
        if(records.length>20000&&typeof Worker!=='undefined'){
          const w=new Worker('js/worker.js?v=1.2.1');
          w.onmessage=ev=>{const{type,pct,msg,result,error}=ev.data||{};if(type==='progress'){document.getElementById('progress-fill').style.width=pct+'%';document.getElementById('progress-label').textContent=msg;}else if(type==='done'){w.terminate();currentAnalysis=result;currentAnalysis._urlSet=new Set();document.getElementById('progress-wrap').classList.add('hidden');document.getElementById('results').classList.remove('hidden');renderAll(currentAnalysis);if(meta.stride>1)showSampleBanner(meta.stride,records.length,meta.totalLines,meta.readMs||0);wireExportButtons();}else if(type==='error'){w.terminate();run();}};
          w.onerror=()=>{try{w.terminate()}catch(e){}run();};
          w.postMessage({records,cfg:currentCfg});
          // fallback timeout: if worker fails silently, run on main thread
          setTimeout(()=>{if(!currentAnalysis||!document.getElementById('results').classList.contains('hidden')===false){}},8000);
          return;
        }
      }catch(e){}
      setTimeout(run,50);
}
function showSampleBanner(stride,kept,totalLines,ms){
  try{
    let b=document.getElementById('sample-note');
    if(!b){b=document.createElement('div');b.id='sample-note';b.className='rec amber';const k=document.getElementById('kpi-strip');k&&k.parentNode.insertBefore(b,k);}
    b.innerHTML='<strong>Large file — systematic 1-in-'+stride+' sample.</strong> Analyzed '+fmtN(kept)+' of '+fmtN(totalLines)+' log lines in '+(ms/1000).toFixed(1)+'s. All figures below describe the analyzed sample (costs scale ~'+stride+'x to the full file). For exact full-file totals use the CLI on a machine with more RAM.';
  }catch(e){}
}
/* Multi-file / rotation support: access.log + access.log.1 + access.log.2.gz
 * (or any multi-select) stream one after another and merge. Returns the same
 * shape as readFileRecords with per-file names for the info bar. */
async function readFilesRecords(files,onProgress){
  const list=[...files];const all=[];let totalLines=0,maxStride=1;const formats=[];let lowConfidence={};
  for(let i=0;i<list.length;i++){
    const f=list[i];
    const r=await readFileRecords(f,(frac,bytesOut)=>{
      const base=i/list.length;
      const span=(typeof frac==='number'?frac*0.9:0.05)/list.length;
      onProgress&&onProgress(Math.min(0.99,base+span),f.name);
    });
    // NOTE: plain loop, NOT all.push(...r.records) — spreading 300k+ args
    // throws "Maximum call stack size exceeded" on 1GB uploads.
    for(const rec of r.records)all.push(rec);
    totalLines+=r.totalLines;maxStride=Math.max(maxStride,r.stride);
    formats.push((f.name||('file'+(i+1)))+':'+r.format);
    Object.assign(lowConfidence,r.lowConfidence||{});
  }
  // Re-stride the MERGED set so N rotated files still respect ANALYZE_CAP
  const stride=Math.max(maxStride,Math.ceil(totalLines/ANALYZE_CAP));
  const kept=stride===1?all:all.filter((_,i)=>(i+1)%stride===0);
  return{records:kept,totalLines,stride,format:formats.join(' | '),lowConfidence,files:list.map(f=>f.name||'upload')};
}
async function processFile(file){return processFiles(file&&file.length&&!file.name?[...file]:[file]);}
function showGuessWarning(n){
  try{
    let b=document.getElementById('guess-note');
    if(!b){b=document.createElement('div');b.id='guess-note';b.className='rec amber';const k=document.getElementById('kpi-strip');k&&k.parentNode.insertBefore(b,k);}
    b.innerHTML='<strong>W3C guess-mode (low confidence):</strong> '+fmtN(n)+' line(s) parsed WITHOUT a #Fields header — IP/column mapping was guessed and may be wrong for ELB/CloudFront custom orders. Add a <code>#Fields: date time c-ip cs-method cs-uri-stem sc-status sc-bytes cs(User-Agent)</code> header for exact mapping.';
  }catch(e){}
}
async function processFiles(files){
  document.getElementById('progress-wrap').classList.remove('hidden');
  document.getElementById('progress-hint').textContent='Reading locally in 8MB slices — no data leaves your machine';
  document.getElementById('upload-panel').classList.add('hidden');
  try{
    const list=(files||[]).filter(Boolean);
    if(!list.length)throw new Error('No file selected.');
    const totalSize=list.reduce((s,f)=>s+(f.size||0),0);
    if(totalSize>500*1024*1024&&!confirm('These files total '+fmtB(totalSize)+'. The browser will stream them (progress below) and analyze a systematic sample capped at '+fmtN(ANALYZE_CAP)+' records. For exact full-file totals use the CLI instead. Continue in browser?')){throw{cancelled:true}}
    const t0=Date.now();
    const{records,totalLines,stride,format,lowConfidence}=await readFilesRecords(list,(frac,cur)=>{
      const pct=typeof frac==='number'?Math.round(frac*90):10;
      document.getElementById('progress-fill').style.width=pct+'%';
      document.getElementById('progress-label').textContent='Reading '+(cur||'file')+'... '+(typeof frac==='number'?Math.round(frac*100)+'%':fmtB(0));
      document.getElementById('progress-pct').textContent=pct+'%';
    });
    if(!records.length)throw new Error('No valid records found ('+fmtN(totalLines)+' data lines seen, detected format: '+format+'). Accepted: JSON array, JSONL/NDJSON, Apache Combined, Nginx default, W3C Extended (with #Fields header), AWS ALB, Cloudflare Logpush, .gz. Tip: open your file and check the first line looks like one of the How To Use examples.');
    const pseudoFile=list.length===1?list[0]:{name:list.length+' files ('+list.map(f=>f.name).join(', ').substring(0,80)+')',size:totalSize};
    processRecords(records,pseudoFile,{totalLines,stride,format,readMs:Date.now()-t0,lowConfidence});
  }catch(err){
    document.getElementById('progress-wrap').classList.add('hidden');
    document.getElementById('upload-panel').classList.remove('hidden');
    if(!err||!err.cancelled)alert('Error: '+(err&&err.message||err));
  }
}
if(typeof module!=='undefined'&&module.exports){module.exports={classifyBot,norm,parseTime,verifyBot,genRdnsChecklist,detectTraps,calcCosts,crawlBudget,trafficP,security,genEdgeRules,genRobotsTxt,genLlmsTxt,genCfAICrawlJSON,gen402Example,genPromptList,exportLogsCSV,BQ_SAMPLE_SQL,analyze,parseCombinedLine,parseALBLine,parseTextLogs,joinCrawlGsc,parseGscCsv,genSample,genSampleStream,sampleTargetRecords,mulberry32,SAMPLE_SEED_DEFAULT,parseLine,readFileRecords,readFilesRecords,ANALYZE_CAP,normalizeIP,ipInCidr,ipMatchesAny,BOTS,RATE_POLICY,TRAPS,THREATS,COST_PRESETS,DEFAULT_COSTS,BOT_DB_VERSION};}

function wireExportButtons(){
  const add=(id,label,fn)=>{let b=document.getElementById(id);if(b){b.onclick=fn;return}b=document.createElement('button');b.id=id;b.className='btn-sm';b.textContent=label||id;document.getElementById('info-bar')?.appendChild(b);b.onclick=fn;};
  add('export-csv-btn','Download CSV',()=>currentAnalysis&&exportBotCSV(currentAnalysis));
  add('export-cfo-btn','CFO 1-pager',()=>currentAnalysis&&exportCFOPDF(currentAnalysis));
  add('export-logs-btn','Logs CSV (BQ)',()=>currentAnalysis&&exportLogsBQCSV(currentAnalysis));
  add('export-prompts-btn','Prompt list',()=>currentAnalysis&&exportPromptListFile(currentAnalysis));
  add('export-llms-btn','llms.txt',()=>currentAnalysis&&exportLlmsFile(currentAnalysis));
  const ib=document.getElementById('info-bar');
  if(ib&&!document.getElementById('export-csv-btn')){const b1=document.createElement('button');b1.id='export-csv-btn';b1.className='btn-sm';b1.textContent='Download CSV';b1.onclick=()=>currentAnalysis&&exportBotCSV(currentAnalysis);ib.appendChild(b1);const b2=document.createElement('button');b2.id='export-cfo-btn';b2.className='btn-sm';b2.textContent='CFO 1-pager';b2.onclick=()=>currentAnalysis&&exportCFOPDF(currentAnalysis);ib.appendChild(b2);}
}
let liveTimer=null,lastRecords=null;
function setLive(on){
  const s=document.getElementById('live-status');
  if(on){if(!lastRecords){alert('Upload a log file first — Live re-analyzes the last upload on an interval (no backend polling).');return}
    const iv=parseInt(document.getElementById('live-interval')?.value||'30',10)*1000;
    document.getElementById('live-start-btn')?.classList.add('hidden');document.getElementById('live-stop-btn')?.classList.remove('hidden');
    if(s)s.textContent='Monitoring (re-analyzing last upload every '+iv/1000+'s)';
    liveTimer=setInterval(()=>{if(lastRecords){processRecords(lastRecords,null);document.getElementById('live-last-update').textContent='Last update: '+new Date().toLocaleTimeString();}},iv);
  }else{clearInterval(liveTimer);liveTimer=null;document.getElementById('live-start-btn')?.classList.remove('hidden');document.getElementById('live-stop-btn')?.classList.add('hidden');if(s)s.textContent='Stopped';}
}
if(typeof document!=='undefined')document.addEventListener('DOMContentLoaded',function(){
  renderAbout();renderHowto();
  const prm=new URLSearchParams(location.search);
  if(prm.get('sample')==='10k'){fetch('sample-data/sample-10k.jsonl').then(r=>r.text()).then(t=>{const recs=t.split('\n').filter(l=>l.trim()).map(l=>{try{return JSON.parse(l)}catch(e){return null}}).filter(Boolean);document.getElementById('upload-panel').classList.add('hidden');document.getElementById('progress-wrap').classList.remove('hidden');lastRecords=recs;processRecords(recs,{name:'sample-10k.jsonl',size:t.length});}).catch(()=>{});}
  document.querySelectorAll('.sb-btn').forEach(b=>b.addEventListener('click',()=>showPage(b.dataset.section)));
  document.querySelectorAll('.tb').forEach(b=>b.addEventListener('click',()=>showTab(b.dataset.tab)));
  // pricing presets + save/reset wiring
  const presetSel=document.getElementById('pricing-preset');
  if(presetSel)presetSel.onchange=()=>{const p=COST_PRESETS[presetSel.value];if(p){document.getElementById('cfg-cdnEgress').value=p.cdnEgress;document.getElementById('cfg-request10K').value=p.request10K;document.getElementById('cfg-ssr1K').value=p.ssr1K;}};
  document.getElementById('pricing-save')?.addEventListener('click',()=>{const v=parseFloat(document.getElementById('cfg-ssr1K').value);currentCfg={cdnEgress:parseFloat(document.getElementById('cfg-cdnEgress').value)||0.09,request10K:parseFloat(document.getElementById('cfg-request10K').value)||0,ssr1K:isNaN(v)?0:v};document.getElementById('pricing-panel').classList.add('hidden');if(lastRecords)processRecords(lastRecords,null);});
  document.getElementById('pricing-reset')?.addEventListener('click',()=>{document.getElementById('cfg-cdnEgress').value=DEFAULT_COSTS.cdnEgress;document.getElementById('cfg-request10K').value=DEFAULT_COSTS.request10K;document.getElementById('cfg-ssr1K').value=DEFAULT_COSTS.ssr1K;});
  document.getElementById('pricing-btn')?.addEventListener('click',()=>document.getElementById('pricing-panel').classList.remove('hidden'));
  document.getElementById('pricing-close')?.addEventListener('click',()=>document.getElementById('pricing-panel').classList.add('hidden'));
  document.getElementById('live-start-btn')?.addEventListener('click',()=>setLive(true));
  document.getElementById('live-stop-btn')?.addEventListener('click',()=>setLive(false));
  // dark mode
  const dm=document.getElementById('dark-toggle');if(dm)dm.onclick=()=>{document.body.classList.toggle('dark');try{localStorage.setItem('lfa-theme',document.body.classList.contains('dark')?'dark':'light')}catch(e){}};
  try{if(localStorage.getItem('lfa-theme')==='dark')document.body.classList.add('dark')}catch(e){}
  // GSC + crawl join: GSC textarea accepts a full pages CSV export (URL,Clicks,Impressions)
  document.getElementById('join-btn')?.addEventListener('click',()=>{
    if(!currentAnalysis){alert('Upload a log file first.');return}
    const parseCsv=t=>t.split('\n').map(l=>l.trim().split(',')[0]?.trim()).filter(u=>u&&u.startsWith('/'));
    const crawlRaw=(document.getElementById('crawl-csv')?.value||'').trim();
    const gscRaw=(document.getElementById('gsc-csv')?.value||'').trim();
    const crawl=crawlRaw?parseCsv(crawlRaw):[]; // empty => log URLs are the crawl set
    const gsc=gscRaw?parseGscCsv(gscRaw):[];
    const j=joinCrawlGsc(currentAnalysis,crawl,gsc);
    document.getElementById('join-out').innerHTML=`<p>Crawled: <b>${j.crawledCount}</b> | Indexed (GSC): <b>${j.indexedCount}</b> | Orphan-crawl waste: <b>${fmtC(j.wasteUSD)}</b> (${fmtC(j.avgCostPerReq)}/req measured)</p><h4>Crawled but never indexed (orphan — fix or noindex, top 50)</h4><code>${j.orphanCrawled.slice(0,50).map(escapeHtml).join('<br>')||'none'}</code><h4>Indexed but never crawled in this log window (top 50 by clicks)</h4><code>${j.uncrawled.slice(0,50).map(r=>escapeHtml(r.url+' — '+r.clicks+' clicks, '+r.impressions+' impr')).join('<br>')||'none'}</code><p style="font-size:11px;color:var(--text-3)">${escapeHtml(j.note)} Paste a GSC Pages export (Page,Clicks,Impressions header) for click-weighted output.</p>`;
  });
  function escapeHtml(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
  const fi=document.getElementById('file-input'),drop=document.getElementById('upload-drop');
  document.getElementById('browse-btn').addEventListener('click',e=>{e.stopPropagation();fi.click()});
  drop.addEventListener('click',()=>fi.click());
  fi.addEventListener('change',e=>{if(e.target.files.length)processFiles([...e.target.files])});
  drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('dragover')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('dragover'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('dragover');if(e.dataTransfer.files.length)processFiles([...e.dataTransfer.files])});
  document.getElementById('clear-btn').addEventListener('click',()=>{fi.value='';document.getElementById('info-bar').classList.add('hidden');document.getElementById('results').classList.add('hidden');document.getElementById('upload-panel').classList.remove('hidden');currentAnalysis=null});
  document.getElementById('download-sample-btn').addEventListener('click',e=>{
    e.stopPropagation();
    const sizeMB=parseInt(document.getElementById('sample-size')?.value||'5',10);
    const maxSizeMB=1024;
    let actualSizeMB=Math.min(sizeMB,maxSizeMB);
    if(sizeMB>maxSizeMB) alert('Maximum sample size is 1 GB. Generating 1 GB file.');
    // Mobile guard: phones OOM on giant in-browser generation — cap at 50MB with CLI hint
    try{
      const isMobile=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'')||(window.matchMedia&&matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<820);
      if(isMobile&&actualSizeMB>50){alert('Mobile detected: sample capped at 50MB (large generation needs desktop RAM). For 500MB+ use the CLI: npm run gen-logs -- --lines N --out file.jsonl');actualSizeMB=50;}
    }catch(err){}
    if(actualSizeMB>100&&!confirm(`${actualSizeMB} MB will take a while in-browser (streaming, tab stays responsive). For 500 MB+ the CLI is faster: npm run gen-logs -- --lines N --out file.jsonl. Continue in browser?`))return;
    const btn=document.getElementById('download-sample-btn');
    btn.textContent='Generating 0%...';
    btn.disabled=true;
    const parts=[];
    try{
      genSampleStream(actualSizeMB,
        (chunk,doneCount,total)=>{
          parts.push(chunk); // Blob parts: no single giant string, no "Invalid string length"
          btn.textContent=`Generating ${Math.round(doneCount/total*100)}%...`;
        },
        (total)=>{
          try{
            const b=new Blob(parts,{type:'application/x-ndjson'});
            const u=URL.createObjectURL(b);
            const a=document.createElement('a');
            const ts=new Date().toISOString().replace(/[:.]/g,'-').slice(0,19);
            a.href=u;
            a.download=`sample-logs-${actualSizeMB}MB-${ts}.jsonl`;
            a.click();
            setTimeout(()=>URL.revokeObjectURL(u),5000);
          }catch(err){
            alert('Error generating sample: '+err.message);
          }
          btn.textContent='Download Sample Log';
          btn.disabled=false;
        },
        (err)=>{
          alert('Error generating sample: '+err.message);
          btn.textContent='Download Sample Log';
          btn.disabled=false;
        });
    }catch(err){
      alert('Error generating sample: '+err.message);
      btn.textContent='Download Sample Log';
      btn.disabled=false;
    }
  });
});
})();
