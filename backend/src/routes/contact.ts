import { Router } from "express";
import { contactConfigured, contactSchema, sendContact } from "../services/contact.js";

// Local limiter: do not trust client-supplied forwarding headers. Use a shared
// gateway limiter when deploying multiple API replicas or behind a proxy.
export function createContactRouter(send = sendContact, configured = contactConfigured) {
  const router = Router();
  const attempts = new Map<string, { count: number; reset: number }>();
  router.post("/", async (req, res) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.reset <= now) attempts.delete(key);
    const key = req.ip || "unknown";
    const entry = attempts.get(key) ?? { count: 0, reset: now + 15 * 60 * 1000 };
    if (entry.count >= 5 || (!attempts.has(key) && attempts.size >= 10000)) {
      res.set("Retry-After", String(Math.max(1, Math.ceil((entry.reset - now) / 1000))));
      return res.status(429).json({ message: "Muitas tentativas em pouco tempo. Aguarde alguns minutos ou fale comigo por email." });
    }
    entry.count++;
    attempts.set(key, entry);
    const parsed = contactSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Confira seu nome, email, assunto e mensagem (de 10 a 5.000 caracteres)." });
    if (parsed.data.website) return res.status(400).json({ message: "Não foi possível enviar este formulário." });
    if (!configured()) return res.status(503).json({ message: "O formulário está temporariamente indisponível. Você pode falar comigo pelo email abaixo." });
    try {
      await send(parsed.data);
      return res.status(200).json({ message: "Mensagem enviada! Obrigado por compartilhar sua ideia. Vou responder pelo email que você informou." });
    } catch {
      console.error("[contact] Email provider delivery failed");
      return res.status(502).json({ message: "Não foi possível confirmar o envio. Sua mensagem continua aqui; tente novamente em alguns minutos ou use o email abaixo." });
    }
  });
  return router;
}
export default createContactRouter();
