import { bootstrap } from "@/server/bootstrap";
import { initPluginRegistry, getPluginSettings } from "@/plugins/registry";
import { LoginClient } from "@/components/auth/login-client";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  bootstrap();
  await initPluginRegistry();
  const settings = getPluginSettings("team");
  const allowRegister = Boolean(settings.allowSelfRegistration ?? true);
  const { status } = await searchParams;

  const inactiveMessage =
    status === "inactive"
      ? "Sua sessao expirou ou sua conta ainda nao foi aprovada."
      : undefined;

  return <LoginClient allowRegister={allowRegister} inactiveMessage={inactiveMessage} />;
}
