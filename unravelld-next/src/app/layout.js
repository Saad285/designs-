import Script from 'next/script';
import "./globals.css";

export const metadata = {
  title: "unravelld.",
  description: "Virtual Try-On and Style Scout",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
        
        {/* We use beforeInteractive so GSAP and Three exist before our custom scripts load */}
        <Script src="https://unpkg.com/@studio-freight/lenis@1.0.34/dist/lenis.min.js" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js" strategy="beforeInteractive" />
        <Script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/Draggable.min.js" strategy="beforeInteractive" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
