import type { Metadata } from "next";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
};

export default function LoginPage() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-12">
      <LoginForm />
    </main>
  );
}
