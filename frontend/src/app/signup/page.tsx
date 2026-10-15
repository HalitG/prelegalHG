import type { Metadata } from "next";
import { SignUpForm } from "@/components/SignUpForm";

export const metadata: Metadata = {
  title: "Create your account",
};

export default function SignUpPage() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-12">
      <SignUpForm />
    </main>
  );
}
