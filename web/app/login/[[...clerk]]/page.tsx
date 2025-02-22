"use client";

import { SignIn } from "@clerk/nextjs";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted p-6">
      <div className="w-full max-w-sm">
        <SignIn path="/login" routing="path" signUpUrl="/signup" />
      </div>
    </div>
  );
}
