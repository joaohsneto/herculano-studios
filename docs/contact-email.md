# Contato — Nodemailer e SMTP do Gmail

O formulário `/contact` chama `POST /api/contact` no Express. O Nodemailer envia o email personalizado em HTML e texto usando o Gmail via SMTP com TLS. O destinatário é fixo: **herculanostudios@gmail.com**. O visitante fica no `Reply-To`, para responder diretamente pelo aplicativo de email.

## Ativar

O arquivo local `backend/.env` já está preparado:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=herculanostudios@gmail.com
SMTP_PASS=
SMTP_FROM=herculanostudios@gmail.com
```

Preencha `SMTP_PASS` com a senha de app gerada na conta **herculanostudios@gmail.com**. Não use sua senha normal, não envie a senha pelo chat e não a versione. Os espaços de agrupamento exibidos pelo Google são removidos automaticamente para o SMTP do Gmail.

Reinicie o backend após salvar (`pnpm --dir backend dev` para iniciar em desenvolvimento). Alterar apenas o `.env` pode não reiniciar o processo automaticamente. A integração não usa Brevo.

## Verificar

Abra `/contact`, envie uma mensagem e confira o Gmail, inclusive spam. Confira também o layout e se “Responder” aponta ao email informado no formulário. O HTTP 200 significa que o SMTP aceitou a mensagem, não uma garantia de entrega na caixa de entrada. Sem senha, o endpoint retorna 503; falhas de autenticação, rede ou rejeição retornam 502, preservando o texto no formulário.

Em produção, configure as variáveis SMTP no backend e `API_URL` no frontend. Nunca use prefixo `NEXT_PUBLIC_` nas credenciais. Porta 587 exige STARTTLS; porta 465 usa TLS desde a conexão. O Gmail aplica limites de envio e pode bloquear acessos suspeitos.

## Proteção e operação

Validação no servidor, limites de tamanho, escape do HTML, campo antispam e cinco tentativas por endereço de conexão a cada 15 minutos. O limite fica em memória e reinicia com o processo. O proxy Next.js pode agrupar visitantes no mesmo endereço: em produção configure limitação por visitante no gateway confiável, com armazenamento compartilhado se houver múltiplas réplicas. Não habilite `trust proxy` indiscriminadamente nem confie em `X-Forwarded-For` enviado por clientes.

Não há confirmação automática ao visitante nem armazenamento no banco. Erros não registram senha nem conteúdo da mensagem.

- [Senhas de app do Google](https://support.google.com/accounts/answer/185833?hl=pt-BR)
- [Nodemailer com Gmail](https://nodemailer.com/guides/using-gmail)
- [Configuração SMTP](https://nodemailer.com/smtp)
