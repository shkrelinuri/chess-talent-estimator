import Link from 'next/link';
import ContactForm from './contact-form';

export const dynamic = 'force-dynamic';

export default function ContactPage() {
  return (
    <main className="app-shell">
      <header className="site-header">
        <Link className="brand-lockup" href="/">
          <span className="brand-mark">♞</span>
          <span>Chess Talent Estimator</span>
        </Link>
        <Link className="text-button" href="/">Back to quiz</Link>
      </header>
      <section className="panel contact-panel" aria-labelledby="contact-heading">
        <div className="eyebrow">CONTACT</div>
        <h1 id="contact-heading">Want to improve?</h1>
        <p className="muted contact-copy">Send us questions about your results, feedback, or the patterns you want to practice.</p>
        <ContactForm />
      </section>
      <footer className="page-footer">Chess is a practice, not a verdict.</footer>
    </main>
  );
}
