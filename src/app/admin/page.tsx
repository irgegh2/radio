import { isAdmin } from '@/lib/auth';
import AdminClient from '@/components/AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  return <AdminClient authenticated={await isAdmin()} />;
}
