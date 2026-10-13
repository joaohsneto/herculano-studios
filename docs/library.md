# Biblioteca de produtos digitais

A página `/account/library` reúne as versões adquiridas em pedidos `PAID`, com busca, filtros por tipo, ordenação, prévias, instruções e downloads. Compras repetidas da mesma versão aparecem uma vez. Produtos arquivados continuam acessíveis aos compradores.

Tipos: beat, drum kit, sample pack, preset, curso, e-book, template e outro produto digital. Os filtros são derivados das compras do cliente. Cursos nesta versão são materiais para download; uma futura área de aulas, progresso e streaming pode usar o mesmo vínculo entre comprador, pedido e versão.

Cada versão aceita vários arquivos. Um arquivo com `variantId` fica restrito àquela versão; um arquivo sem `variantId` é material comum às versões do produto. O painel administrativo permite anexar arquivos e capas. Instruções de entrega são cadastradas junto ao produto.

O cadastro de beats salva o áudio original para a versão do formato correspondente. Os outros formatos devem ser anexados pelo painel. O cadastro de kits salva o ZIP completo como download, além de gerar as prévias. Os demais tipos salvam o arquivo enviado sem processamento de áudio.

`GET /api/account/library` retorna metadados sem caminhos privados ou chaves de armazenamento. `GET /api/account/library/:purchaseId/files/:assetId` verifica sessão, propriedade do pedido, pagamento, produto e versão antes de servir um anexo privado. `?check=1` verifica disponibilidade antes do navegador iniciar o download. Reembolsos e cancelamentos bloqueiam o acesso daquele pedido; outra compra paga da versão mantém sua disponibilidade.

Arquivos adicionados após a compra aparecem com o aviso “Novo material”. O aviso compara a data de inclusão à data de compra; não rastreia leitura ou download. Rótulos de licença vêm da versão cadastrada; PDFs de licença podem ser anexados à versão como arquivos.

## Verificação

```sh
pnpm --dir backend exec tsx --test ../tests/library.test.mts
LIBRARY_INTEGRATION=1 pnpm --dir backend exec tsx --test ../tests/library.test.mts
```

O segundo comando usa o banco local configurado em `backend/.env`, cria fixtures isoladas e as remove ao finalizar. Testa conteúdo de cursos/e-books, vários arquivos por versão, materiais comuns, compras repetidas, produto arquivado, bloqueio para outra conta/versão/produto, pedidos pendentes/reembolsados e arquivo ausente.
