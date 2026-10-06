import { getNotices } from "@/lib/data";
import AdminNotices from "@/components/site/admin-notices";

export default async function Page() {
  const notices = await getNotices();
  return <AdminNotices initial={notices} />;
}
