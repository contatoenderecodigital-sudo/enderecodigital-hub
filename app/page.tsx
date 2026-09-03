import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { foodHabilitado } from "@/lib/food-auth";

export default async function Home() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.papel === "owner_plataforma") redirect("/owner");
  if (s.papel === "parceiro") redirect("/parceiro");
  // dono e operador de restaurante: o painel deles e o AppFood
  if ((s.papel === "dono" || s.papel === "operador") && s.negocio_id) {
    if (await foodHabilitado(s.negocio_id)) redirect(`/food/${s.negocio_id}`);
  }
  redirect("/login");
}
