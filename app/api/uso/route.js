import { auth } from "../../../auth";
import { getApiUsage } from "../../../lib/hubspot";

// Consumo diário da API do HubSpot (limite é da conta inteira, não só deste app).
export async function GET() {
  const session = await auth();
  if (!session?.user?.isAdmin) {
    return Response.json({ error: "Apenas admin." }, { status: 403 });
  }
  try {
    const uso = await getApiUsage();
    return Response.json(uso);
  } catch (e) {
    return Response.json({ error: e?.message || "falhou" }, { status: 502 });
  }
}
