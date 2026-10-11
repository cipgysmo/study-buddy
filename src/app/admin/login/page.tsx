import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { adminPasswordEnabled } from "@/lib/admin-auth";
import { AdminLoginForm } from "@/components/admin/admin-login-form";

export default async function AdminLoginPage() {
  const t = await getTranslations("Admin");
  if (!adminPasswordEnabled()) redirect("/admin");

  return (
    <div className="mx-auto max-w-md space-y-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted">{t("loginHint")}</p>
      </div>
      <AdminLoginForm />
    </div>
  );
}
