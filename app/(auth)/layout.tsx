import Link from "next/link";
import { BookOpen } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-6 py-10">
      <Link href="/" className="flex items-center gap-2 font-semibold">
        <BookOpen className="size-5" />
        CriaBook
      </Link>
      {children}
    </div>
  );
}
