# Vendored runtime (no CDN, no network at runtime)

These two files are byte-identical copies of the pinned npm packages
(`npm install --save-exact jspdf@2.5.1 jspdf-autotable@3.8.2`), committed so
the app — and its offline/privacy audit — never depends on a CDN:

- `jspdf.umd.min.js` — jsPDF 2.5.1, MIT (c) James Hall broadening the
  horizon — https://github.com/parallax/jsPDF
- `jspdf-autotable.min.js` — jsPDF-AutoTable 3.8.2, MIT (c) Simon Bengtsson —
  https://github.com/simonbengtsson/jsPDF-AutoTable

Verify: `sha256sum js/vendor/*` matches `node_modules/jspdf/dist/*` and
`node_modules/jspdf-autotable/dist/*`. Used only by `../cfo-pdf.js`
(CFO PDF download). `node_modules/` itself is gitignored and never deployed.
