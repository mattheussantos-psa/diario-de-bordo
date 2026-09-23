export const dynamic = "force-dynamic";

// Qual versão está no ar. Público de propósito e sem dado sensível: serve para
// responder "o deploy já saiu?" com fato em vez de suposição — essa dúvida já
// custou várias idas e vindas.
export async function GET() {
  const env = process.env;
  return Response.json(
    {
      commit: (env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) || "desconhecido",
      mensagem: env.VERCEL_GIT_COMMIT_MESSAGE || "",
      branch: env.VERCEL_GIT_COMMIT_REF || "",
      deployadoEm: env.VERCEL_DEPLOYMENT_ID ? env.VERCEL_URL : "local",
      agora: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
