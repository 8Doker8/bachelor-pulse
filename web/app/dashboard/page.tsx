// app/dashboard/page.tsx
import { redirect } from "next/navigation";

export default function DashboardPage() {
  // Automatically redirect to the progress page.
  redirect("/dashboard/progress");
  return null;
}
