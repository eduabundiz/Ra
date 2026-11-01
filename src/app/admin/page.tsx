import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { snapshot } from "@/lib/repository";
import { isDemo } from "@/lib/config";
import { serviceClient } from "@/lib/supabase";
import { Dashboard } from "@/components/admin";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Administración",
  robots: { index: false, follow: false },
};
export default async function AdminPage() {
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  const s = await snapshot(true);
  const admins = isDemo()
    ? [{ user_id: a.id, email: a.email, role: a.role, active: true }]
    : (
        await serviceClient()
          .from("admin_accounts")
          .select("user_id,email,role,active")
          .order("email")
      ).data || [];
  return (
    <Dashboard
      initial={{
        ...s,
        admin: a,
        admins,
        demo: isDemo(),
        integration: {
          configured: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
          mode: process.env.WHATSAPP_MODE || "disabled",
        },
      }}
    />
  );
}
