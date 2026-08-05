import { redirect } from "next/navigation";
import { auth, signIn } from "../../auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <div className="login">
      <div className="login-card">
        <img className="logo" src="/logo-psa.png" alt="PSA" />
        <h1>Diário de Bordo</h1>
        <p>Acesso restrito aos closers da PSA.</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/" });
          }}
        >
          <button className="gbtn" type="submit">Entrar com Google</button>
        </form>
      </div>
    </div>
  );
}
