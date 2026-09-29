'use client';

import { useState } from 'react';

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '', website: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('sending');
    setError('');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Your message could not be sent.');
      setForm({ name: '', email: '', message: '', website: '' });
      setStatus('sent');
    } catch (caught) {
      setStatus('error');
      setError(caught.message || 'Your message could not be sent. Please try again.');
    }
  }

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <label htmlFor="contact-name">Name</label>
      <input id="contact-name" name="name" value={form.name} onChange={updateField} autoComplete="name" maxLength={100} required />
      <label htmlFor="contact-email">Email</label>
      <input id="contact-email" name="email" type="email" value={form.email} onChange={updateField} autoComplete="email" maxLength={254} required />
      <label htmlFor="contact-message">How can we help?</label>
      <textarea id="contact-message" name="message" value={form.message} onChange={updateField} rows={6} maxLength={5000} required />
      <div className="contact-honeypot" aria-hidden="true">
        <label htmlFor="contact-website">Leave this field empty</label>
        <input id="contact-website" name="website" value={form.website} onChange={updateField} tabIndex={-1} autoComplete="off" />
      </div>
      {status === 'sent' && <p className="inline-message" role="status">Message sent. We’ll be in touch.</p>}
      {status === 'error' && <p className="inline-message error" role="alert">{error}</p>}
      <button className="primary-button contact-email-button" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send message'}
      </button>
      <p className="fine-print contact-note">Never include your password or license key in a message.</p>
    </form>
  );
}
