import { getNotices } from "@/lib/data";
import StudentHome from "@/components/site/student-home";

export default async function Page() {
  const notices = await getNotices(5);
  return (
    <StudentHome
      notices={notices.map((n) => ({ id: n.id, title: n.title, date: n.date, category: n.category }))}
    />
  );
}
