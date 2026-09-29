import './globals.css';

export const metadata = {
  title: 'Chess Talent Estimator',
  description: 'A quick tactical quiz to explore your chess instincts.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
