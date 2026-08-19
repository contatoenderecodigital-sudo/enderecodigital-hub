import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.papel === "owner_plataforma") redirect("/owner");
  if (s.papel === "parceiro") redirect("/parceiro");
  redirect("/login");
}
