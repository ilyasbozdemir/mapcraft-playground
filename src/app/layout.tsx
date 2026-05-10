import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MapCraft | Advanced Geospatial Playground",
  description: "A professional tool for visualizing, editing, and exporting GeoJSON, KML, Shapefile, and GPX data with ease.",
  keywords: ["geojson", "kml", "shapefile", "map", "leaflet", "geospatial", "gis"],
  authors: [{ name: "Ilyas Bozdemir" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-background text-foreground antialiased`}>
        <TooltipProvider>
          {children}
          <Toaster position="top-right" richColors />
        </TooltipProvider>
      </body>
    </html>
  );
}
