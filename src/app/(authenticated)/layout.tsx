import AuthenticatedLayout from "@/components/layout/AuthenticatedLayout";

export default function RootAuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
