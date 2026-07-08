import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "DIKIS p1",
  description: "Universeel metadata-gestuurd kennissysteem",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body className="bg-slate-50 text-slate-900 min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}