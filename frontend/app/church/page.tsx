import type { Metadata } from "next";
import ChurchPortal from "@/components/ChurchPortal";

export const metadata: Metadata = { title: "Church Portal · Taifa District of SDA" };

export default function Page() {
  return <ChurchPortal />;
}
