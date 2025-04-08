import React from 'react';
import { Layout } from './Layout';

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <Layout>
      {children}
    </Layout>
  );
};