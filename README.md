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
