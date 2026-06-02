import Link from "next/link";
import { BookOpen } from "lucide-react";

import { AuthShaderBackground } from "@/components/ui/auth-shader-background";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center gap-8 overflow-hidden bg-zinc-950 px-6 py-10">
      <AuthShaderBackground />
      <Link
        href="/"
        className="relative z-10 flex items-center gap-2 font-semibold text-white"
      >
        <BookOpen className="size-5 text-indigo-400" />
        CriaBook
      </Link>
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
