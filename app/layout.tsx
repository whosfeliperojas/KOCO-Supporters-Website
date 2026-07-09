import type { Metadata } from "next";
import { Poppins, Caveat } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-poppins",
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-caveat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KOCO Supporters",
  description: "KOICA Colombia Supporters Program",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Follow the user's chosen language (helps assistive tech and date inputs
  // in browsers that honor the lang attribute)
  const cookieStore = await cookies();
  const raw = cookieStore.get("koco-locale")?.value;
  const lang = raw === "en" || raw === "ko" ? raw : "es";

  return (
    <html lang={lang} className={`${poppins.variable} ${caveat.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
