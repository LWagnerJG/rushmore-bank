import type { Metadata } from "next";
import { HomePage } from "@/components/HomePage";
import { createManifestHref } from "@/shared/web-manifest";

type HomeSearch = { create?: string; room?: string };

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<HomeSearch>;
}): Promise<Metadata> {
  const sp = await searchParams;
  return {
    manifest: createManifestHref(sp.create === "1"),
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<HomeSearch>;
}) {
  const sp = await searchParams;
  return <HomePage createIntent={sp.create === "1"} />;
}
