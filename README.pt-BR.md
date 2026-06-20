# LazyNevis

[English](README.md) | [Português (Brasil)](README.pt-BR.md)

<p align="center"><img src="src/assets/brand/logo-dark.png" alt="LazyNevis" height="60"></p>
<p align="center"><strong>para quem é leizis, mas não desistis.</strong></p>
<p align="center">
  <a href="https://github.com/simstm/lazy-nevis/actions/workflows/ci.yml"><img src="https://github.com/simstm/lazy-nevis/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/simstm/lazy-nevis/releases/latest"><img src="https://img.shields.io/github/v/release/simstm/lazy-nevis?label=release&color=brightgreen" alt="Último Release"></a>
  <a href="https://github.com/simstm/lazy-nevis/releases"><img src="https://img.shields.io/github/v/release/simstm/lazy-nevis?include_prereleases&label=pre-release&color=orange" alt="Último Pre-release"></a>
  <a href="https://github.com/simstm/lazy-nevis/releases"><img src="https://img.shields.io/github/downloads/simstm/lazy-nevis/total?label=downloads" alt="Total de Downloads"></a>
  <img src="https://img.shields.io/badge/plataforma-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey" alt="Plataformas: macOS, Windows, Linux">
  <a href="LICENSE"><img src="https://img.shields.io/badge/licença-MIT-blue.svg" alt="Licença MIT"></a>
  <a href="https://www.buymeacoffee.com/simstm"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-apoie-FFDD00?logo=buymeacoffee&logoColor=000" alt="Buy Me a Coffee"></a>
</p>

LazyNevis é uma ferramenta desktop de foco com privacidade por padrão. Durante uma sessão, classifica localmente a janela ativa e orienta sem bloquear — sem conta, nuvem, analytics ou telemetria.

---

## Sobre o nome

*LazyNevis* é um trocadilho com **Lazy** (preguiçoso) e **Never** (nunca), processado pelo filtro inconfundível do **Mussum** — Antônio Carlos Bernardes Gomes, o eterno integrante d'Os Trapalhões que transformou o português numa arte própria.

O Mussum tinha um dom: ele acrescentava *-is* em palavras que não pediam — *Cacildis*, *Horrivis*, *Mé* — e de repente tudo ficava mais engraçado e absolutamente inesquecível. Passe esse filtro na palavra *Never* e você tem *Nevis*.

Então **LazyNevis** soa como *Lazy Never* → **o preguiçoso que nunca desiste de focar**.

O logotipo presta o tributo que merece: o chapéu vermelho/rosa característico do Mussum e um sorriso escondido embaixo do *-is* final do *Nevis* — exatamente onde ele assinava o estilo.

Para quem não cresceu assistindo Os Trapalhões, *LazyNevis* simplesmente parece uma palavra inventada, e tudo bem. Figma, Trello e Bun também não significam nada fora do contexto deles.

---

## O que é o LazyNevis?

A maioria dos apps de foco bloqueia sites ou prende você num timer. O LazyNevis toma outra abordagem: observa, classifica e orienta — e sai do caminho.

Durante uma sessão, o LazyNevis verifica a janela ativa a cada segundo e a classifica como **focada**, **distraída** ou **ociosa** com base nas regras que você definir. Se a distração acumular além de um limite configurado, um alerta é disparado: notificação nativa, overlay em tela cheia ou som. Você decide o que fazer. Nada é bloqueado.

**Local e privado por design.** Todos os dados de sessão, configurações e arquivos de áudio ficam no diretório de dados do sistema. Não há sincronização na nuvem, conta, analytics ou telemetria. A única requisição de rede é o botão explícito **Verificar atualizações**, que lê apenas metadados públicos de releases no GitHub — nunca baixa nem executa nada automaticamente.

---

## Recursos

### Gestão de sessão
- Iniciar, pausar, retomar e parar — nenhum tempo contado durante pausas
- Checkpoints manuais para marcar momentos importantes
- Recuperação segura após crash; sessões salvas a cada cinco segundos
- Timers em tempo real de foco, distração e ociosidade

### Classificação de foco
- **Modo allowlist** — apenas janelas correspondentes contam como foco; o restante é distração
- **Modo blocklist** — janelas correspondentes contam como distração; o restante é foco
- Correspondência por nome de aplicativo ou título de aba do navegador

### Alertas e notificações
- Notificações nativas do sistema operacional
- Overlay em tela cheia (acima de todas as outras janelas; pressione Escape para dispensar)
- Limite de distração e cooldown configuráveis por tipo de alerta

### Áudio
- Sons de alerta integrados
- Arquivos de áudio personalizados: MP3, WAV, OGG
- Som em loop no overlay que para automaticamente ao dispensar

### Pausas
- Intervalo de pausa configurável com base no tempo de foco acumulado
- Contagem regressiva no Dashboard
- Histórico de pausas por sessão

### Histórico e exportação
- Lista de sessões com filtros por intervalo de datas
- Detalhe da sessão com timeline visual, gráfico de apps por tempo e gráfico de foco
- Exportação como JSON (completo) ou CSV (resumo)

### Personalização
- Idioma: inglês (EUA) e português brasileiro
- Tema: claro e escuro
- Atalhos globais configuráveis com detecção de conflitos
- Iniciar com o sistema (opcional)
- Operação pela bandeja do sistema

---

## Capturas de tela

Capturas de releases ficam em [`docs/screenshots`](docs/screenshots/README.md) e são produzidas a partir de candidatos a release, sem substituir a interface real por mockups.

---

## Download e instalação

Baixe apenas em [GitHub Releases](https://github.com/simstm/lazy-nevis/releases). Não use espelhos não oficiais.

| Sistema | Arquitetura | Pacote | Guia |
|---|---|---|---|
| macOS 12+ | Apple Silicon (ARM64) | DMG | [docs/install/macos.md](docs/install/macos.md) |
| Windows 10+ | x64, ARM64 | Instalador NSIS | [docs/install/windows.md](docs/install/windows.md) |
| Linux | x64 | AppImage, DEB, RPM | [docs/install/linux.md](docs/install/linux.md) |

Builds RC podem não ser assinadas enquanto as credenciais de assinatura são configuradas. Veja [macOS Gatekeeper](docs/troubleshooting/gatekeeper.md) e [Windows SmartScreen](docs/troubleshooting/smartscreen.md) para os passos de liberação. Após instalar, siga o [Guia de primeiros passos](docs/getting-started.md).

---

## Permissões e privacidade

**macOS:** Acessibilidade (obrigatória) — lê o nome do aplicativo ativo e o título da janela. O LazyNevis não lê teclas digitadas. Notificações (opcional) — necessárias apenas para alertas nativos.

**Windows:** Nenhuma permissão especial além de executar o instalador.

**Linux:** WebKit2GTK e uma biblioteca de bandeja do sistema são dependências. Veja o [guia de instalação Linux](docs/install/linux.md).

**Rede:** Sem telemetria, analytics ou verificação automática de atualizações. O botão **Verificar atualizações** lê metadados públicos do GitHub, mantém o resultado por 15 minutos e nunca baixa nem executa nada.

Todos os dados ficam no diretório de dados do aplicativo. Veja [PRIVACY.md](PRIVACY.md), [locais de dados e desinstalação](docs/release/installation.md), e [limitações conhecidas](docs/release/known-limitations.md).

---

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
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features --locked -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
bun run quality
```

Bundles de produção: `bun run tauri build`.

Fluxo para contribuidores: [CONTRIBUTING.md](CONTRIBUTING.md) — Arquitetura: [docs/architecture/overview.md](docs/architecture/overview.md) — Release: [docs/architecture/release.md](docs/architecture/release.md).

---

## Solução de problemas

| Tópico | Guia |
|---|---|
| macOS Gatekeeper | [docs/troubleshooting/gatekeeper.md](docs/troubleshooting/gatekeeper.md) |
| Windows SmartScreen | [docs/troubleshooting/smartscreen.md](docs/troubleshooting/smartscreen.md) |
| Permissões | [docs/troubleshooting/permissions.md](docs/troubleshooting/permissions.md) |
| Áudio | [docs/troubleshooting/audio.md](docs/troubleshooting/audio.md) |
| Bandeja | [docs/troubleshooting/tray.md](docs/troubleshooting/tray.md) |
| Atalhos globais | [docs/troubleshooting/shortcuts.md](docs/troubleshooting/shortcuts.md) |
| Bibliotecas Linux | [docs/troubleshooting/linux-libraries.md](docs/troubleshooting/linux-libraries.md) |

Dúvidas de uso vão em [Discussions](https://github.com/simstm/lazy-nevis/discussions). Bugs usam o formulário de issue. Vulnerabilidades seguem [SECURITY.md](SECURITY.md).

---

## Roadmap

Isso é direção, não promessa de entrega.

**Em breve:** completar preparação para release, testes em máquina limpa, configuração de assinatura e instaladores verificados. Aprimorar a verificação manual de atualizações preservando a privacidade.

**Depois:** avaliação de Linux ARM64 e macOS x64. Homebrew Cask e Winget após URLs de artefatos assinados estáveis. Acessibilidade, localização, diagnósticos de regras e exportações mais ricas.

**Sem compromisso:** sincronização na nuvem, apps móveis, monitoramento em equipe, extensões de navegador, repositórios de pacotes, Snap/Flatpak ou app stores.

---

## Comunidade

Leia [CONTRIBUTING.md](CONTRIBUTING.md) e [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). O projeto usa a licença MIT.
