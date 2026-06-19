# LazyNevis

[English](README.md) | [Português (Brasil)](README.pt-BR.md)

<p align="center"><img src="src/assets/brand/logo-dark.png" alt="LazyNevis" height="60"></p>
<p align="center"><strong>para preguiçosos que não desistis.</strong></p>
<p align="center"><a href="LICENSE"><img src="https://img.shields.io/badge/licença-MIT-blue.svg" alt="Licença MIT"></a> <a href="https://www.buymeacoffee.com/simstm"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-apoie-FFDD00?logo=buymeacoffee&logoColor=000" alt="Buy Me a Coffee"></a></p>

LazyNevis é uma ferramenta desktop de foco com privacidade por padrão. Durante uma sessão, classifica localmente a janela ativa e orienta sem bloquear.

## Recursos

- Sessões com pausa, recuperação, checkpoints, histórico, exportação JSON/CSV e SQLite local.
- Regras de allowlist/blocklist para aplicativos e títulos do navegador.
- Notificações, alertas em tela cheia, áudio, cooldown, pausas e atalhos globais.
- Inglês e português brasileiro, temas claro e escuro e operação pela bandeja.
- Sem conta, nuvem, analytics ou telemetria.

## Capturas De Tela

As capturas de releases ficam em [`docs/screenshots`](docs/screenshots/README.md). A lista cobre Dashboard, Histórico, Configurações, alertas e os dois temas. Elas são produzidas a partir de candidatos a release, sem substituir a interface real por mockups.

## Download E Instalação

O primeiro release verificado será publicado em [GitHub Releases](https://github.com/simstm/lazy-nevis/releases). Não baixe de espelhos não oficiais.

| Sistema | Arquitetura | Pacotes | Estado |
|---|---|---|---|
| macOS 12+ | Apple Silicon (ARM64) | DMG e arquivo do app | RC pode ser não assinado até existirem credenciais Apple |
| Windows 10+ | x64 e ARM64 | MSI ou NSIS EXE | RC pode ser não assinado até existirem credenciais |
| Linux | x64 | AppImage, DEB e RPM | Debian/Ubuntu e uma distribuição RPM precisam passar em máquina limpa |

A instalação recomendada baixa, inspeciona e executa o script versionado. Veja [instalação e verificação](docs/release/installation.md). Um comando que envia script remoto direto ao shell não consegue verificar o próprio script antes da execução.

## Permissões E Privacidade

- **Acessibilidade (macOS):** necessária para identificar aplicativo/janela ativos; o LazyNevis não lê teclas digitadas.
- **Notificações:** opcionais, apenas para alertas nativos.
- **Iniciar com o sistema:** opcional e controlado nas Configurações.
- **Rede:** não há telemetria nem sincronização. O botão explícito **Verificar atualizações** consulta apenas metadados públicos de releases na API oficial do GitHub, mantém o resultado por 15 minutos e nunca baixa ou executa uma atualização.

Os dados ficam no diretório de dados do aplicativo do sistema. Consulte [PRIVACY.md](PRIVACY.md), [locais de dados e desinstalação](docs/release/installation.md) e [limitações conhecidas](docs/release/known-limitations.md).

## Desenvolvimento

Instale [Bun](https://bun.sh/), Rust estável e as [dependências do Tauri v2](https://v2.tauri.app/start/prerequisites/).

```bash
git clone https://github.com/simstm/lazy-nevis.git
cd lazy-nevis
bun install --frozen-lockfile
bun run tauri dev
```

```bash
bun run test
bun run build
cargo test --manifest-path src-tauri/Cargo.toml --locked
bun run quality
```

Veja [CONTRIBUTING.md](CONTRIBUTING.md), [arquitetura](docs/architecture/overview.md), [release](docs/architecture/release.md) e as páginas de [solução de problemas](docs/troubleshooting/permissions.md). Os termos sessão, regra de foco, allowlist, blocklist, distração, ociosidade, checkpoint, overlay, cooldown e pausa estão definidos no [glossário em inglês](README.md#glossary).

## Comunidade

Leia [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SUPPORT.md](SUPPORT.md) e [GOVERNANCE.md](GOVERNANCE.md). O projeto usa a licença MIT.
