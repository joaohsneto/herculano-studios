# Autenticação com Auth.js no Express

A autenticação usa `@auth/express`, com os provedores Credentials e Google. O Express continua sendo o backend e o Next.js encaminha `/api` pelo proxy existente. Auth.js gerencia OAuth, CSRF, cookies e sessões JWT criptografadas. A integração Express é experimental; a versão resolvida está fixada pelo lockfile.

## Cadastro e contas existentes

- `/register` cria a conta no Prisma com hash bcrypt. O frontend então faz login pelo provedor Credentials do Auth.js, com token CSRF.
- `/login` aceita senha ou Google. Cadastro, validação e hash de senha permanecem responsabilidade do aplicativo.
- Contas, senhas, pedidos e permissões existentes são preservados. O cadastro local não verifica a propriedade do email.
- O primeiro acesso Google cria um cliente e preserva o identificador `googleId`. Contas existentes com esse identificador continuam funcionando. Uma coincidência de email com uma conta local não vincula automaticamente as contas: nesse caso, use a senha existente.
- As sessões antigas (`hs_access`, `hs_refresh`) não são mais aceitas. Usuários precisam entrar novamente após a migração. Os registros antigos de refresh token ficam preservados no banco, mas não são usados.
- Sessões Auth.js duram até 30 dias. `/api/auth/session` pode renovar o cookie. Permissões e existência do usuário são consultadas no banco nas rotas protegidas. `/api/auth/me` mantém o contrato usado pelo frontend.
- Logout usa POST `/api/auth/signout` com CSRF. As antigas rotas `/login`, `/logout` e `/refresh` da API foram substituídas pelos endpoints Auth.js.

## Configuração Google

A senha de app do Gmail é exclusiva do envio de emails. Para login Google:

1. No [Google Cloud Console](https://console.cloud.google.com/), configure a tela de consentimento e crie um cliente OAuth **Aplicativo da Web**.
2. Cadastre exatamente o callback:
   `http://localhost:3000/api/auth/callback/google`
   Atenção: o caminho mudou; o antigo terminava em `/google/callback`.
3. Preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `backend/.env` e reinicie o backend.
4. Se a aplicação Google estiver em teste, inclua os usuários autorizados no painel.

```dotenv
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

O Auth.js usa o `JWT_SECRET` existente como segredo; opcionalmente, configure `AUTH_SECRET` com pelo menos 32 caracteres aleatórios para substituí-lo. Trocar o segredo invalida sessões. Nenhuma credencial deve usar prefixo `NEXT_PUBLIC_`.

Em produção, use `FRONTEND_URL` com HTTPS, configure o callback correspondente no Google e `API_URL` no frontend. O backend fixa a origem de autenticação a `FRONTEND_URL`, evitando confiar em Host/X-Forwarded-* enviados pelo cliente. Use o mesmo endereço no navegador e na configuração.

Sem credenciais Google, o provedor fica desativado e o botão apresenta uma mensagem amigável. O layout e o cadastro por senha continuam disponíveis.

## Segurança e testes

- Auth.js aplica PKCE, state e nonce no Google; exige-se email verificado.
- O banco preserva apenas a identidade Google, sem tokens de acesso do provedor.
- Cookies são HttpOnly, SameSite=Lax e Secure quando o site usa HTTPS.
- POSTs do Auth.js exigem CSRF; POSTs com Origin diferente do site são recusados.
- Tentativas de login/cadastro são limitadas em memória. Em produção com proxies/múltiplas réplicas, aplique limites por visitante no gateway com armazenamento compartilhado.
- Códigos OAuth e respostas sensíveis não são registrados pelo logger da API.

Testes com Google simulado (sem conta real):
`node --import ./backend/node_modules/tsx/dist/loader.mjs --test tests/authjs.test.mts`

Teste com banco local e usuário temporário, removido ao final:
`node --import ./backend/node_modules/tsx/dist/loader.mjs .tools/test-registration.mts`

O login Google real ainda exige as credenciais e a confirmação do usuário no Google.

Referências: [Auth.js Express](https://authjs.dev/reference/express), [Credentials](https://authjs.dev/getting-started/authentication/credentials), [Google](https://authjs.dev/getting-started/providers/google).
