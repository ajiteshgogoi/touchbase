import { ReactNode } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { Navbar } from './Navbar';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white overflow-x-hidden flex flex-col">
      <Analytics />
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4 pt-8 flex-grow">
        <div className="bg-white rounded-xl shadow-soft p-6 sm:p-8">
          {children}
        </div>
      </main>
      <footer className="text-center pt-2 pb-5 text-gray-600 text-sm">
        © {new Date().getFullYear()} TouchBase
      </footer>
    </div>
  );
};