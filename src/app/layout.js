import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-main",
});

export const metadata = {
  title: "Portfolio | Développeur Senior",
  description: "Portfolio personnel interactif et premium",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr" className={outfit.variable}>
      <body>{children}</body>
    </html>
  );
}
