import type { Metadata } from "next";
import { SignUpClient } from "./SignUpClient";

export const metadata: Metadata = {
  title: "Get started · NEO BANK OS 2026",
};

export default function SignUpPage() {
  return <SignUpClient />;
}
