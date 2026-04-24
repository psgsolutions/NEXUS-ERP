import type { Metadata } from "next";
import { Roboto, JetBrains_Mono } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import "./globals.css";

const roboto = Roboto({
  weight: ["400", "500", "700"],
  subsets: ["latin", "thai"],
  display: "swap",
  variable: "--font-roboto",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "NEXUS ERP | Intelligence OS",
  description: "Enterprise Strategic ERP for the Intelligence Era",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th">
      <body
        className={`${roboto.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <AuthProvider>
          <div className="fixed inset-0 -z-10 bg-[#09090b]" />
          {/* Background Ambient Glows */}
          <div className="fixed top-0 left-1/4 w-[500px] h-[500px] bg-nexus-blue/5 blur-[120px] rounded-full -z-10" />
          <div className="fixed bottom-0 right-1/4 w-[600px] h-[600px] bg-nexus-teal/5 blur-[120px] rounded-full -z-10" />
          
          <main className="relative min-h-screen flex flex-col">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
