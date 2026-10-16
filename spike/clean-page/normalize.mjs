// Normalizes the clean page HTML so the snapshot is stable across environments.
// Usage: node normalize.mjs < page.html > page.normalized.html
let html = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => (html += c));
process.stdin.on('end', () => {
  const out = html
    // Plain and JSON-escaped (`\/`) URLs.
    .replace(/https?:(\\?\/){2}localhost:\d+/g, '{{SITE}}')
    .replace(/(uploads\\?\/)\d{4}(\\?\/)\d{2}(\\?\/)/g, '$1{{YYYY}}$2{{MM}}$3')
    .replace(/"timezoneOffset":-?\d+(\.\d+)?/g, '"timezoneOffset":{{TZ_OFFSET}}')
    // Split tags onto lines so snapshot diffs are readable.
    .replace(/></g, '>\n<');
  process.stdout.write(out.endsWith('\n') ? out : out + '\n');
});
