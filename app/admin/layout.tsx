import type { Metadata } from "next";

// Keep the admin dashboard out of search engines / link previews. Actual access
// is gated by the password (validated server-side on /api/sessions).
export const metadata: Metadata = {
  title: "TalentGraph Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
