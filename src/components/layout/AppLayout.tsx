import { useStore } from '../../stores/useStore';
import { Layout } from './Layout';

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useStore();

  return (
    <Layout user={user}>
      {children}
    </Layout>
  );
};