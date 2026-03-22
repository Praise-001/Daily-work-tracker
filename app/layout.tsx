import "./globals.css";
import type { ReactNode } from "react";
import Providers from "./providers";

export const metadata = { title: "RateLog", description: "Track your work hours and earnings" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme — runs synchronously before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('rl-theme');if(t)document.documentElement.setAttribute('data-theme',t);}catch(e){}`,
          }}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
