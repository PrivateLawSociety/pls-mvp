# Private Law Society MVP (Minimum Viable Product)

[**[🇧🇷] Versão em português: LEIAME.md**](LEIAME.md)

## TL;DR

PLS (Private Law Society) is a project seeking to support the creation of contracts where both parties agree on an arbitrator (or multiple arbitrators) and Bitcoin is used as collateral, so that the contract has its due enforcement. The parties send the necessary collateral to the contract, where it can be later redeemed if either:

1. Both parties agree
2. One of the parties + the arbitrators agree

This means the arbitrators can't run off with the money by themselves, but they can still financially punish the other party.

## Useful links

[Join the Discord server here](https://discord.gg/PNE3PZTUNz)

[PLS Youtube channel](https://www.youtube.com/@privatelawsociety)

[PLS Twitter page](https://twitter.com/PrivateLawSoc)

[Hosted website for the MVP](https://pls-mvp.vercel.app/)

[🇧🇷] [Podcast episode about PLS](https://www.youtube.com/watch?v=NGx7h9kpPE8)

[More documentation can be found here](https://github.com/PrivateLawSociety/pls-mvp/wiki)

## Developing

Once you've downloaded the project and installed dependencies with `pnpm install`, start a development server:

```bash
# `-- --open` opens the website in a new browser tab
pnpm run dev -- --open
```

## Running Locally

To create a production version:

```bash
pnpm run build
```

You can preview the production build with `pnpm run preview`.
