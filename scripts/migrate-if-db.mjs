// Aplica as migrações do banco no deploy — só quando DATABASE_URL existe
// (sem banco, a plataforma roda em modo local e o build segue normalmente).
import { execSync } from "node:child_process";

if (!process.env.DATABASE_URL) {
  console.log("[migrate] DATABASE_URL ausente — contas desativadas, pulando migrações.");
} else {
  execSync("npx prisma migrate deploy", { stdio: "inherit" });
}
