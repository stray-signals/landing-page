// Finds all transmissions/log.json entries with signal_sent: false,
// discovers each target's webmention endpoint, POSTs the webmention,
// and updates signal_sent: true on success.
// Run by GitHub Actions after each deploy.

const fs   = require('fs');
const path = require('path');

const LOG_PATH  = path.join(__dirname, '..', 'transmissions', 'log.json');
const SITE_BASE = 'https://straysignals.dev';

// ── Endpoint discovery ─────────────────────────────────────────────
// Checks Link header first, then parses HTML for <link rel="webmention">
async function findEndpoint(targetUrl) {
  const res = await fetch(targetUrl, { redirect: 'follow' });

  const linkHeader = res.headers.get('link') ?? '';
  const headerMatch = linkHeader.match(/<([^>]+)>;\s*rel="webmention"/i);
  if (headerMatch) return new URL(headerMatch[1], targetUrl).href;

  const html = await res.text();
  const htmlMatch =
    html.match(/<link[^>]+rel=["']webmention["'][^>]+href=["']([^"']+)["']/i) ??
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']webmention["']/i) ??
    html.match(/<a[^>]+rel=["']webmention["'][^>]+href=["']([^"']+)["']/i);
  if (htmlMatch) return new URL(htmlMatch[1], targetUrl).href;

  return null;
}

// ── Send ───────────────────────────────────────────────────────────
async function sendWebmention(source, target, endpoint) {
  const res = await fetch(endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ source, target }).toString(),
  });
  // 200, 201, or 202 all mean accepted
  return res.status === 200 || res.status === 201 || res.status === 202;
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
  const log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8'));
  let changed = false;

  const pending = log.filter(e => e.url && e.signal_status !== 'sent');
  if (!pending.length) {
    console.log('No pending transmissions.');
    return;
  }

  for (const entry of pending) {
    const source   = `${SITE_BASE}/transmissions/${entry.id}/`;
    const target   = entry.url;

    console.log(`\n── ${entry.id}`);
    console.log(`   source: ${source}`);
    console.log(`   target: ${target}`);

    try {
      const endpoint = await findEndpoint(target);
      if (!endpoint) {
        console.log('   no webmention endpoint found');
        entry.signal_status = 'no_endpoint';
        changed = true;
        continue;
      }
      console.log(`   endpoint: ${endpoint}`);

      const ok = await sendWebmention(source, target, endpoint);
      if (ok) {
        entry.signal_status = 'sent';
        changed = true;
        console.log('   ✓ signal sent');
      } else {
        entry.signal_status = 'failed';
        changed = true;
        console.log('   ✗ endpoint rejected the webmention');
      }
    } catch (err) {
      console.log(`   error: ${err.message}`);
    }
  }

  if (changed) {
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + '\n');
    console.log('\nlog.json updated.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
