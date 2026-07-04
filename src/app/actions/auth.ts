"use server";

import { redirect } from "next/navigation";
import { authenticateForLogin, createSession, destroySession } from "@/lib/auth";
import { registerPendingUser } from "@/plugins/team/actions";

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe email e senha." };
  }

  const { user, reason } = await authenticateForLogin(email, password);
  if (!user) {
    if (reason === "pending") {
      return { error: "Cadastro aguardando aprovacao do administrador." };
    }
    if (reason === "rejected") {
      return { error: "Seu cadastro foi rejeitado. Contate o administrador." };
    }
    return { error: "Credenciais invalidas." };
  }

  await createSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  redirect("/");
}

export async function registerAction(_prev: unknown, formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (!name || !email || !password) {
    return { error: "Preencha nome, email e senha.", success: false };
  }
  if (password.length < 6) {
    return { error: "Senha deve ter pelo menos 6 caracteres.", success: false };
  }
  if (password !== confirm) {
    return { error: "Senhas nao conferem.", success: false };
  }

  try {
    await registerPendingUser({ name, email, password, title: title || undefined });
    return {
      success: true,
      error: "",
      message: "Cadastro enviado! Aguarde a aprovacao do administrador para entrar.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erro ao cadastrar.", success: false };
  }
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
