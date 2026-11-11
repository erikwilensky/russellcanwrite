import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: { absolute: "Russell Can Write" },
  description: "Win the war on run-on sentences.",
  robots: { index: false, follow: false },
  applicationName: "Russell Can Write",
  appleWebApp: { capable: true, title: "Russell Can Write", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = { themeColor: "#10151c", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#10151c", color: "#e8e4d8" }}>{children}</body>
    </html>
  );
}
