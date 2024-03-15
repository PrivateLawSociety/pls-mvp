# MVP (Produto Mínimo Viável) da Private Law Society

[**[🇺🇸] English version: README.md**](README.md)

## Resumo

PLS (Private Law Society) é um projeto que busca possibilitar a criação de contratos onde ambas as partes escolhem um árbitro (ou múltiplos árbitros) e o Bitcoin é utilizado como garantia, para que o contrato tenha sua devida execução. As partes enviam as garantias necessárias ao contrato, onde poderão ser posteriormente resgatadas se:

1. Ambas as partes concordarem
2. Uma das partes + os árbitros concordarem

Isso significa que os árbitros não podem fugir sozinhos com o dinheiro, mas ainda podem punir financeiramente a parte que perdeu a disputa.

## Links Úteis

[Entre no servidor do Discord por aqui](https://www.privatelawsociety.net/join)

[Youtube do PLS](https://www.youtube.com/@privatelawsociety)

[Twitter do PLS](https://twitter.com/PrivateLawSoc)

[Site hospedado do MVP](https://pls-mvp.vercel.app/)

[Episódio de podcast sobre a PLS](https://www.youtube.com/watch?v=NGx7h9kpPE8)

[🇺🇸] [Mais documentação pode ser encontrada aqui](https://private-law-society.gitbook.io/docs/)

## Desenvolvimento

Depois de baixar o projeto e instalar as dependências com `pnpm install`, inicie um servidor de desenvolvimento:

```bash
# `-- --open` abre o site em uma nova aba do navegador
pnpm run dev -- --open
```

## Executando localmente

Para criar uma versão de produção:

```bash
pnpm run build
```

Você pode ver a compilação de produção com `pnpm run preview`.
