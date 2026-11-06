# Memor App · Laboratório React Native

Experimento isolado de interface e realidade aumentada para **iPhone (ARKit) e Android (ARCore)**. Não substitui o [Memor SwiftUI](https://github.com/joeespindola1983/memor) e não acessa Supabase.

**Identificador QA (iOS e Android):** `com.espindola.memor.app.qa`

## Escopo deste protótipo

- **Locais:** lista, criação e detalhes, com rascunhos persistidos **apenas neste aparelho**.
- **Laboratório AR:** alternância **Criar / Visualizar** sem desmontar a sessão nativa.
- **Intervenções:** texto 3D e cartão expositivo de exemplo, posicionados em plano detectado.
- **Observação importante:** as coordenadas 3D pertencem à sessão AR atual. Rascunhos aparecem no Arquivo local, mas não são recolocados automaticamente ao reiniciar a RA. Ainda não existe VPS, cloud anchor, compartilhamento ou importação de ARWorldMap.
- Sem autenticação, moderação, publicação, upload ou acesso ao banco do Memor original.

## Stack

Expo SDK 57 / React Native 0.86.3 / React 19.2.3 / TypeScript / ReactVision ViroReact 3.0.3 / Expo Router / AsyncStorage.
Escolhemos a combinação do [starter oficial ViroReact](https://github.com/ReactVision/expo-starter-kit-typescript). **O Expo Go não suporta o ViroReact:** compilar dev build.

## Executar

Requer Node.js >= 22.13, Xcode (para iPhone), Android Studio/SDK (para Android) e aparelho físico com ARKit/ARCore.

```sh
git clone https://github.com/joeespindola1983/memor-app.git
cd memor-app
git switch feat/react-native-ar-lab
npm install
npx expo install --check
npm run test
npm run typecheck
npx expo prebuild --clean
npx expo run:ios --device
# OU (com Android físico conectado):
npx expo run:android --device
```

Depois do primeiro build nativo, use `npm run start` para o Metro.

### Roteiro de QA

1. Em **Locais**, tocar em **Novo lugar**, dar um nome e salvar; reiniciar o app e conferir persistência local.
2. Abrir o lugar; tocar **Abrir laboratório AR** em aparelho compatível.
3. Em **Criar**, apontar para uma superfície plana e esperar o ARKit/ARCore reconhecer o plano; escolher **Texto** ou **Cartão** e colocar o marcador pela mira central.
4. Trocar para **Visualizar** **sem sair da tela de RA**; conferir o marcador na posição e caminhar ao redor.
5. Voltar para **Detalhes** e conferir a lista de rascunhos. Ao reentrar na RA as posições não serão restauradas — isso é proposital neste estágio.
6. Repetir o mesmo fluxo em iPhone e Android, registrando tempo até detectar plano, precisão e comportamento do tracking.

Consulte [docs/architecture.md](docs/architecture.md) e [docs/qa-matrix.md](docs/qa-matrix.md).

## Resultado esperado

Esta primeira etapa valida UX, build cross-platform, detecção de superfície e criação/visualização **na mesma sessão**. Só depois implementaremos localização persistente cross-platform e imagens reais. Não confundir reprodução de uma posição `[x,y,z]` em outra sessão com relocalização do mundo físico.

## Troubleshooting iPhone / Metro / ARKit

O build de desenvolvimento não contém obrigatoriamente um bundle JavaScript embutido. O servidor **Metro deve estar acessível** enquanto o app é aberto no iPhone.

1. No iPhone, permitir **Memor QA** em **Ajustes → Privacidade e Segurança → Rede Local**, e confirmar a permissão de câmera. O app declara `NSLocalNetworkUsageDescription` e `_expo._tcp` para o desenvolvimento.
2. Mac e iPhone na mesma rede Wi-Fi (sem isolamento de clientes/VPN bloqueando a LAN). O iPhone deve conseguir abrir `http://IP_DO_MAC:8081/status` no Safari, com resposta `packager-status:running`.
3. Rodar no primeiro terminal `npx expo start --dev-client --lan --clear`; no segundo, `npx expo run:ios --device --no-bundler`. O primeiro comando fica aberto.
4. Se a permissão de Rede Local ainda não aparecer, reconstruir com `npx expo prebuild --clean --platform ios` e `npx expo run:ios --device --no-bundler`. **Não é necessário apagar os rascunhos do aparelho para tentar de novo**.
5. Na tela de RA, esperar **RASTREAMENTO ATIVO** antes de criar. O teste de posição agora roda por `ViroARScene.performARHitTestWithRay`, usando a cena montada — não o navigator.
6. Mensagens como `FigCaptureSourceRemote` e `poor slam` exigem observar tracking e câmera no aparelho; elas não demonstram isoladamente um crash fatal. Fechar outros apps que estejam usando câmera e testar em local iluminado e texturizado.

Nenhuma alteração desta correção toca no app SwiftUI, seu ARWorldMap, Supabase ou conteúdo compartilhado.

## Instalação npm / React 19

A versão do React neste experimento é **19.2.3**. O `react-dom` opcional requisitado pelo Expo também está fixado em **19.2.3**, para impedir que npm escolha `19.3.x` e rejeite o peer dependency com `ERESOLVE`.

```sh
npm install
npm run deps:check
npm run test
npm run typecheck
```

**Não use `--force` nem `--legacy-peer-deps`** para contornar este conflito. Depois de validar a instalação local, `package-lock.json` deve ser versionado para instalações reproduzíveis.

### Diagnóstico de superfícies (raycast)

A partir desta revisão, a cena AR passa a direção real da câmera (`onCameraTransformUpdate.forward`) para `performARHitTestWithRay`. O vetor fixo `[0, 0, -1]` anterior não acompanhava a inclinação do celular. O navigator usa `depthEnabled`, permitindo resultados `DepthPoint` em aparelhos compatíveis.

A experiência mostra **DIREÇÃO DA CÂMERA**, **PROFUNDIDADE** e **ÚLTIMO TESTE**. A seleção prioriza plano real, depois profundidade real e por último plano horizontal estimado. Estimativas ficam explicitamente identificadas como **experimentais** e os dados seguem sem relocalização espacial persistente. Se o log do iPhone registrar `poor slam`, o ARKit ainda pode não conseguir fornecer nenhum resultado mesmo com o código corrigido.

## Nova base do produto

A branch `feat/memor-product-migration-foundation` migra as telas principais e os contratos editoriais do SwiftUI. Consulte [o plano](docs/migration-roadmap.md).

O mapa usa **Apple Maps no iOS** e **Google Maps SDK no Android**. Para mapas Android, configure uma chave restrita via `EXPO_ANDROID_MAPS_API_KEY` durante o build. A criação e visualização AR continuam restritas a dispositivos compatíveis com ARKit/ARCore.

Novos módulos nativos (`react-native-maps`, `expo-location`) exigem recompilação do app, não apenas reload do Metro. Dados locais continuam isolados deste Memor QA.

## M2 — Captura guiada e edição (QA)

A branch `feat/memor-capture-edit-flow` adiciona a jornada **CRIAR → varredura com tracking → nomear sem câmera → lugar salvo → criar/visualizar em RA → editar/excluir obra no Arquivo**.

**Use [o checklist de amanhã](docs/capture-edit-qa.md).** Depois de abrir a RA, os textos e cartões podem ser posicionados e movidos na mesma sessão. O novo fluxo grava *metadados diagnósticos* da varredura, nunca um `ARWorldMap` recuperável. Ao reabrir, a pose 3D antiga não é exibida até que exista um provedor real de relocalização (VPS/Cloud Anchor).

```bash
git fetch origin
git switch feat/memor-capture-edit-flow
npm install
npm run test
npm run typecheck
npx expo install --check
npx expo prebuild --clean --platform ios
npx expo run:ios --device
```

O iPhone requer ARKit e o Android, dispositivo certificado para ARCore. No iOS, os mapas comuns usam Apple Maps; nenhum token do Supabase é necessário. Não apagar o app QA antigo se quiser manter seus rascunhos.

## POC de relocalização ReactVision VPS (branch `feat/memor-reactvision-vps-poc`)

Veja [`docs/reactvision-vps-qa.md`](docs/reactvision-vps-qa.md). O ReactVision VPS é **opcional**: sem as duas variáveis abaixo, o aplicativo permanece em modo de captura local. Não versionar `.env`.

```bash
cp .env.example .env
# Preencha .env com a chave CLIENTE pública recebida no ReactVision Studio e o Project ID correspondente:
# REACTVISION_CLIENT_KEY=rv_client_...
# REACTVISION_PROJECT_ID=<Project ID do Studio>

npm install
npm run typecheck
npm run test
npx expo prebuild --clean --platform ios
npx expo run:ios --device
```

A configuração é **nativa**: faça um rebuild ao inserir ou alterar Project ID ou chave. A chave de cliente é pública por design, mas **nunca** use uma `rv_secret_` dentro do app.

**Teste:** CRIAR → iniciar mapeamento VPS → aguardar cobertura de keyframes, pares e dispersão → finalizar/hospedar → nomear → abrir RA → esperar `LUGAR RECONHECIDO` → posicionar texto → sair e voltar ao mesmo ambiente. As obras novas têm `locationPosition` relativa à âncora recuperável; obras legadas têm apenas posição da sessão original. O servidor ReactVision guarda a âncora espacial, e somente o sandbox do app QA guarda os textos e o ID. Não há sincronização entre usuários até implementar Supabase.
