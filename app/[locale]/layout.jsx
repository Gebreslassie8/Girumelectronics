import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { AuthProvider } from '@/components/providers/AuthProvider';
import ProfileProvider from '@/components/providers/ProfileProvider';
import { Toaster } from 'react-hot-toast';
import '../globals.css';

export const metadata = {
  title: 'ግሩም ኤሌክትሮኒክስ',
  description: 'Girum Electronics — modern stove and appliance management',
};

export default async function LocaleLayout({ children, params }) {
  const { locale } = await params;

  if (!routing.locales.includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <ProfileProvider>
              {children}
              <Toaster position="top-right" />
            </ProfileProvider>
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
