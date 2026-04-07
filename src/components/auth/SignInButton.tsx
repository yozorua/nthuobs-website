"use client";

import { signIn } from "next-auth/react";
import { Chrome } from "lucide-react";

interface SignInButtonProps {
  className?: string;
  callbackUrl?: string;
}

export default function SignInButton({
  className = "",
  callbackUrl = "/dashboard",
}: SignInButtonProps) {
  return (
    <button
      onClick={() => signIn("google", { callbackUrl })}
      className={`flex items-center gap-3 px-6 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-[#3f91ff]/40 text-[#eaebf2] font-medium transition-all duration-300 group ${className}`}
    >
      <Chrome className="w-5 h-5 text-[#3f91ff] group-hover:scale-110 transition-transform" />
      <span>Sign in with Google</span>
    </button>
  );
}
