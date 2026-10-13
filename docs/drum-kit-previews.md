# Prévia dos drum kits

Em **Produtos**, selecione um drum kit. A área **Prévias do drum kit** mostra os sons públicos por categoria.

- **Trocar som** abre os arquivos da mesma pasta. Busque pelo nome, ouça um candidato, selecione-o e confirme em **Usar como prévia**.
- **Sortear outro** substitui somente aquela posição por um som ainda não usado na categoria.
- A audição dos candidatos exige acesso administrativo. O ZIP permanece privado; somente as prévias confirmadas são públicas.
- As escolhas são persistentes. A prévia anterior só é removida depois de a nova conversão e o salvamento terem sucesso.
- Um kit novo recebe até dois sons sorteados por pasta. Pastas com um único áudio recebem uma prévia e não oferecem alternativas.
- Kits antigos aproveitam o ZIP privado de download, quando disponível. Caso não exista, envie o ZIP original na área de prévias; os sons atuais são mantidos.

A conversão mantém a regra existente de amostras de até oito segundos, com fade e MP3. A edição do trecho dos beats não foi modificada.

## Banco de dados

A migração `20261005000000_kit_preview_selection` adiciona `PreviewAudio.sourceEntry`, que registra o caminho do som dentro do ZIP. Ao instalar em outro ambiente, execute `pnpm --dir backend exec prisma migrate deploy` e `pnpm --dir backend prisma:generate`.

## Validação

- `node --import tsx --test ../tests/kit-preview.test.mts` (no diretório backend).
- `KIT_PREVIEW_INTEGRATION=1 node --import tsx --test ../tests/kit-preview-integration.test.mts` (no diretório backend, com banco local e FFmpeg).

Os testes de integração criam e removem um produto temporário e arquivos isolados, sem alterar as escolhas dos kits existentes.
