// Public privacy policy page — required by Meta for publishing the WhatsApp
// app, and good practice regardless. Intentionally outside the (app) group so
// it needs no login.

export const metadata = {
  title: "Privacy Policy — Mandy",
};

const SECTIONS: { heading: string; body: string[] }[] = [
  {
    heading: "Who we are",
    body: [
      "Mandy is an AI sales coordinator used by photography businesses to respond to customer enquiries — on this website and, where connected, on messaging channels such as WhatsApp.",
    ],
  },
  {
    heading: "What we collect",
    body: [
      "When you message a business that uses Mandy, we process the messages you send, your contact identifier (such as your WhatsApp phone number or profile name), and details you choose to share in conversation (for example an event date, location, or budget).",
      "We do not collect payment card details, passwords, or government identification through chat.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "Your messages are used solely to respond to your enquiry on behalf of the business you contacted: answering questions, recommending services and packages, and passing the conversation to the business owner when a human reply is needed.",
      "Conversations are stored securely so the business can review and continue them. Message content is processed by an AI language-model service provider strictly to generate replies.",
    ],
  },
  {
    heading: "What we don't do",
    body: [
      "We do not sell your personal data. We do not use your conversations to advertise to you. We do not share your information with anyone other than the business you contacted and the service providers needed to operate the product (hosting, database, and AI processing).",
    ],
  },
  {
    heading: "Data retention & your rights",
    body: [
      "Conversation records are kept for as long as the business needs them to serve you. You may request access to, correction of, or deletion of your personal data at any time by contacting the business you messaged, or by emailing the contact below.",
    ],
  },
  {
    heading: "Contact",
    body: [
      "For privacy questions or data requests, contact: eugene@asteriskandhashtag.com",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="eyebrow">Mandy</p>
      <h1 className="mt-1 text-3xl font-bold tracking-tight text-wine">Privacy Policy</h1>
      <p className="mt-2 text-sm text-wine-soft/60">Last updated: 5 July 2026</p>

      <div className="mt-10 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.heading}>
            <h2 className="text-lg font-bold text-wine">{s.heading}</h2>
            {s.body.map((p, i) => (
              <p key={i} className="mt-2 text-sm leading-relaxed text-wine-soft">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </main>
  );
}
