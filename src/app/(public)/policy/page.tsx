import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy — SendFlow',
  description: 'How SendFlow collects, uses, and protects your data.',
};

export default function PolicyPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Nav */}
      <nav className="bg-surface border-b border-gray-100 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
              <path d="M12 0C5.373 0 0 5.373 0 12c0 2.11.547 4.11 1.497 5.84L0 24l6.335-1.663A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.1 0-4.102-.545-5.81-1.485L2.19 18.1l-.495-1.71 1.665-4.37A9.94 9.94 0 0112 2c5.523 0 10 4.477 10 10s-4.477 10-10 10z"/>
            </svg>
          </div>
          <span className="font-heading text-lg text-slate">SendFlow</span>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">
        <h1 className="font-heading text-4xl text-slate">Privacy Policy</h1>
        <p className="text-sm text-slate-light">Effective date: May 2026</p>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-slate">What we collect</h2>
          <p className="text-slate-light leading-relaxed">When you sign up for SendFlow, we collect your name, email address, phone number, and business information. This is so we can create your account, send you invoices, and provide support.</p>
          <p className="text-slate-light leading-relaxed">We also collect usage data — such as campaigns sent, delivery rates, and contact counts — to power your dashboard and help you understand your marketing performance.</p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-slate">How we use your data</h2>
          <ul className="space-y-2 text-slate-light list-disc pl-5">
            <li>To send your WhatsApp campaigns on your behalf</li>
            <li>To generate delivery reports and analytics</li>
            <li>To process payments (via Paystack, MTN Mobile Money, or bank transfer)</li>
            <li>To notify you about your account, billing, and service updates</li>
            <li>To improve our platform and fix bugs</li>
          </ul>
          <p className="text-slate-light leading-relaxed">We <strong>never sell your data</strong> to third parties.</p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-slate">Data storage and security</h2>
          <p className="text-slate-light leading-relaxed">Your data is stored on secure servers. WhatsApp message content is held only as long as needed to deliver your campaigns. Contact lists can be deleted at any time upon request.</p>
          <p className="text-slate-light leading-relaxed">Payment information (card numbers, MoMo numbers) is handled directly by Paystack — we never store your financial details on our servers.</p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-slate">Cookies</h2>
          <p className="text-slate-light leading-relaxed">We use cookies to keep you logged in and remember your preferences. You can disable cookies in your browser, but some features (like login) may stop working.</p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-slate">Your rights</h2>
          <p className="text-slate-light leading-relaxed">You can ask us to export or delete your data at any time. Email us at <strong>support@sendflow.app</strong> with your request. We process data requests within 5 business days.</p>
        </section>

        <section className="space-y-4">
          <h2 className="font-heading text-xl text-slate">Contact us</h2>
          <p className="text-slate-light leading-relaxed">Questions about this policy? Email <strong>support@sendflow.app</strong>.</p>
        </section>

        <hr className="border-gray-100" />

        {/* Refund Policy */}
        <section className="space-y-4">
          <h2 className="font-heading text-2xl text-slate">Refund Policy</h2>
          <p className="text-sm text-slate-light">Last updated: May 2026</p>

          <h3 className="font-heading text-lg text-slate mt-6">Eligibility for refunds</h3>
          <p className="text-slate-light leading-relaxed">SendFlow offers refunds within <strong>7 days</strong> of your first payment if you are not satisfied with the service. To request a refund, email <strong>support@sendflow.app</strong> with your account email and reason for requesting a refund.</p>

          <h3 className="font-heading text-lg text-slate mt-6">What is not refundable</h3>
          <ul className="space-y-2 text-slate-light list-disc pl-5">
            <li>Messages already sent at the time of the refund request are not refunded</li>
            <li>Monthly plans after 7 days from the billing date</li>
            <li>One-time add-on purchases (e.g., extra message packs)</li>
            <li>Accounts terminated for violation of our terms of service</li>
          </ul>

          <h3 className="font-heading text-lg text-slate mt-6">How refunds are processed</h3>
          <p className="text-slate-light leading-relaxed">Approved refunds are processed back to the original payment method (MTN Mobile Money or card) within <strong>5–10 business days</strong>. You will receive a confirmation email once the refund is initiated.</p>

          <h3 className="font-heading text-lg text-slate mt-6">Request a refund</h3>
          <p className="text-slate-light leading-relaxed">Email <strong>support@sendflow.app</strong> with:</p>
          <ul className="space-y-2 text-slate-light list-disc pl-5">
            <li>Your registered email address</li>
            <li>The plan or amount you paid</li>
            <li>The reason for your refund request</li>
          </ul>
          <p className="text-slate-light leading-relaxed">We aim to respond to all refund requests within 2 business days.</p>
        </section>

        <hr className="border-gray-100" />

        {/* Terms of Service */}
        <section className="space-y-4">
          <h2 className="font-heading text-2xl text-slate">Terms of Service</h2>
          <p className="text-sm text-slate-light">Effective: May 2026</p>

          <h3 className="font-heading text-lg text-slate mt-6">Acceptable use</h3>
          <p className="text-slate-light leading-relaxed">You agree to use SendFlow only for lawful marketing communications. You must not use the platform to send spam, scam messages, or any content that violates Ghanaian or applicable law. We reserve the right to suspend or terminate accounts that breach this policy.</p>

          <h3 className="font-heading text-lg text-slate mt-6">Message delivery</h3>
          <p className="text-slate-light leading-relaxed">While we aim for 99.9% uptime, WhatsApp delivery rates depend on WhatsApp's infrastructure and recipient behavior. We do not guarantee that every message will be delivered or read.</p>

          <h3 className="font-heading text-lg text-slate mt-6">Billing</h3>
          <p className="text-slate-light leading-relaxed">Plans are billed monthly or annually. You can cancel your subscription at any time — you will retain access until the end of your paid period. We do not prorate cancellations mid-cycle unless in exceptional circumstances.</p>

          <h3 className="font-heading text-lg text-slate mt-6">Account responsibility</h3>
          <p className="text-slate-light leading-relaxed">You are responsible for keeping your login details secure. SendFlow is not liable for unauthorized access to your account if your credentials were compromised.</p>

          <h3 className="font-heading text-lg text-slate mt-6">Contact</h3>
          <p className="text-slate-light leading-relaxed">Questions about these terms? Email <strong>support@sendflow.app</strong>.</p>
        </section>
      </div>

      {/* Footer */}
      <footer className="bg-slate text-gray-400 py-6 px-6 mt-8">
        <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-amber flex items-center justify-center text-white text-xs font-bold">S</div>
            <span className="text-white font-heading">SendFlow</span>
          </div>
          <div>
            © 2026 SendFlow. Built for African businesses 🇬🇭
          </div>
        </div>
      </footer>
    </div>
  );
}