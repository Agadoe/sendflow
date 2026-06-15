// Standalone smoke test for the magic-link email flow.
// Run with: npx tsx scripts/test-magic-link.ts
//
// Bypasses the HTTP layer, calls sendMail() directly with a test recipient.
// Email will land at APPROVAL_INBOX (Tedymiles7@gmail.com) thanks to testMode=true.

import { sendMail, verifySmtp } from '../src/lib/email';

async function main() {
  console.log('[smoke] verifying SMTP...');
  const v = await verifySmtp();
  console.log('[smoke] verifySmtp:', v);
  if (!v.ok) {
    console.error('[smoke] SMTP verify failed; aborting');
    process.exit(1);
  }

  const fakeToken = 'smoke-test-' + Date.now();
  const base = process.env.NEXT_PUBLIC_APP_URL || 'https://sendflow-two.vercel.app';
  const verifyUrl = `${base}/api/auth/verify?token=${fakeToken}`;

  console.log('[smoke] sending test magic-link to', 'don@baahe.org', '...');
  const result = await sendMail({
    to: 'don@baahe.org',
    subject: 'SendFlow smoke test — magic-link',
    text: `Smoke test ${new Date().toISOString()}\nVerify URL: ${verifyUrl}`,
    html: `<p>Smoke test ${new Date().toISOString()}</p>
           <p>Verify URL: <code>${verifyUrl}</code></p>`,
    testMode: true,
  });

  console.log('[smoke] result:', result);
  process.exit(result.ok ? 0 : 1);
}

main();
