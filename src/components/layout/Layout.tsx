import { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Navbar } from './Navbar';
import { getFullVersion } from '../../constants/version';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen min-w-[320px] bg-gradient-to-br from-primary-50 to-white flex flex-col">
      <Analytics />
      <Navbar />
      <main className="w-full min-w-[320px] min-h-[600px] max-w-4xl mx-auto px-4 pb-4 pt-8 flex-grow">
        <div className="w-full h-full min-h-[600px] bg-white rounded-xl shadow-soft p-6">
          {children}
        </div>
      </main>
      <footer className="text-center pt-2 pb-5 text-gray-600 text-sm">
        © {new Date().getFullYear()} TouchBase Technologies | {getFullVersion()}
      </footer>
    </div>
  );
};