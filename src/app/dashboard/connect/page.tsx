import WacliConnectPage from '@/components/WacliConnectPage';
import { Toaster } from 'react-hot-toast';

export default function ConnectPage() {
  return (
    <>
      <WacliConnectPage />
      <Toaster position="top-right" />
    </>
  );
}
