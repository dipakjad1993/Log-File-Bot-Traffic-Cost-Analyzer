/* Web Worker: off-main-thread analyze() for 20k+ row logs. Falls back to main thread on error. */
importScripts('analyzer.js?v=1.2.1');

self.onmessage = function (ev) {
  try {
    const { records, cfg } = ev.data || {};
    if (!records || !records.length) {
      self.postMessage({ type: 'error', error: 'no records' });
      return;
    }
    const result = analyze(records, cfg || {}, (pct, msg) => {
      self.postMessage({ type: 'progress', pct, msg });
    });
    // _records is stripped for structured-clone safety; _urlSet (plain array) is kept for the GSC join
    try { delete result._records; } catch (e) {}
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', error: String((err && err.message) || err) });
  }
};
