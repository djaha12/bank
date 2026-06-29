import type { Metadata } from "next";
import { SignInClient } from "./SignInClient";

export const metadata: Metadata = {
  title: "Sign in · NEO BANK OS 2026",
};

export default function SignInPage() {
  return <SignInClient />;
}
