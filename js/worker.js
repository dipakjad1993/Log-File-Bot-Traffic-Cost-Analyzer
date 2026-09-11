/* Web Worker: off-main-thread analyze() for 20k+ row logs. Falls back to main thread on error. */
importScripts('analyzer.js');

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
    // _urlSet / _records are stripped for structured-clone safety; UI rebuilds as needed
    try { delete result._records; } catch (e) {}
    try { result._urlSet = []; } catch (e) {}
    self.postMessage({ type: 'done', result });
  } catch (err) {
    self.postMessage({ type: 'error', error: String((err && err.message) || err) });
  }
};
