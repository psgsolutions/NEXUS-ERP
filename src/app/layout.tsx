import type { Metadata } from "next";
import { Sarabun, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { SystemAlertProvider } from "@/components/ui/SystemAlertProvider";
import { ConnectionProvider } from "@/context/ConnectionContext";
import { DialogProvider } from "@/context/DialogContext";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { LanguageProvider } from "@/context/LanguageContext";

const sarabun = Sarabun({
  weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
  subsets: ["thai", "latin"],
  display: "swap",
  variable: "--font-sarabun",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "NEXUS ERP | Intelligence OS",
  description: "Next-Generation Enterprise Strategic System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${sarabun.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="antialiased selection:bg-nexus-blue/30 overflow-hidden" suppressHydrationWarning>
        <LanguageProvider>
          <AuthProvider>
            <ConnectionProvider>
            <SystemAlertProvider>
              <DialogProvider>
                <div className="relative h-screen w-full bg-[#020203] overflow-hidden">
                  {/* Unified Ambient Background */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(20,163,204,0.08)_0%,transparent_50%)] pointer-events-none" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(16,187,168,0.05)_0%,transparent_50%)] pointer-events-none" />
                  
                  <div className="relative z-10 h-full w-full">
                    {children}
                  </div>
                </div>
              </DialogProvider>
            </SystemAlertProvider>
            </ConnectionProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
