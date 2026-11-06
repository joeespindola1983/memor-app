# Memor QA · Prova de conceito ReactVision VPS

**Branch:** `feat/memor-reactvision-vps-poc` · Expo SDK 57 · ReactVision ViroReact 3.0.3.  
**Objetivo:** provar a revisita física de intervenções **novas**, posicionadas no frame persistente de uma âncora espacial, antes de investir na nossa própria infraestrutura de relocalização.

## 1. Preparação (não versionar credenciais)

No [ReactVision Studio](https://studio.reactvision.xyz/), abra **Team → Projects → seu projeto**. Copie o **Project ID**. Ele precisa ser o projeto ao qual a chave `rv_client_...` está vinculada (em **Integrations → API Keys**).

A chave de cliente é considerada **pública pelo fornecedor** e destinada ao app. Uma chave `rv_secret_` não deve ir para dispositivos nem Git.

```sh
git fetch origin
git switch feat/memor-reactvision-vps-poc
git pull --ff-only
cp .env.example .env
# edite .env e preencha:
# REACTVISION_CLIENT_KEY=<a chave rv_client_ fornecida pelo dono do projeto>
# REACTVISION_PROJECT_ID=<Project ID do mesmo projeto>
npm install
npm run test
npm run typecheck
npx expo install --check
npx expo prebuild --clean --platform ios
npx expo run:ios --device
```

**É obrigatório recompilar** depois de preencher credenciais, porque `app.config.ts` injeta `RVApiKey` e `RVProjectId` no código nativo. Não basta recarregar o Metro. Para Android, requer dispositivo ARCore certificado e build Android com a mesma configuração.

## 2. Fluxo de ponta a ponta

1. Abra o **Memor QA → CRIAR** e aguarde `RASTREAMENTO ATIVO`.
2. Toque em **INICIAR MAPEAMENTO VPS**. Isso inicia `startScan()` do ReactVision; **não** é a heurística local anterior.
3. Explore um lugar autorizado, rico em detalhes, de diferentes ângulos e com boa iluminação. Observe keyframes, pares de pontos de vista e dispersão. A UI consulta `getScanStatus()` aproximadamente a 1 Hz.
4. Quando o scan e o rastreamento estiverem prontos, use **FINALIZAR E HOSPEDAR VPS** (`finishScan(7)`). Essa chamada pode transferir **características visuais** do lugar à plataforma ReactVision. Não é upload de JPEG, da malha 3D ou de textos.
5. Sucesso exige resposta nativa `success`, **`cloudAnchorId`** e **`locationTransform`** válidos. Em caso de falha, veja o erro + diagnósticos e refaça varredura.
6. Na tela seguinte, a câmera foi desmontada: informe nome, localização opcional e **SALVAR LUGAR COM VPS**. O registro local fica em AsyncStorage.
7. Abra o lugar em **CRIAR / VISUALIZAR EM RA**. Observe `RECONHECENDO LUGAR`, caminhe pelo espaço escaneado e aguarde `LUGAR RECONHECIDO`. A cena usa `ViroARCloudAnchor` e a mesma âncora.
8. **Somente depois de reconhecido** posicione um texto. O raycast é convertido com `parseLocationTransform` + `worldToLocation` e persistido como `locationPosition`, enquanto a posição transitória fica em `sessionPosition`.
9. Saia totalmente da câmera; reabra o lugar, aguarde novo reconhecimento. **A obra com `locationPosition` deve reaparecer na mesma posição física**, sujeita a testar drift e qualidade do VPS. Veja também o texto `MEMOR / LOCAL RECONHECIDO` no frame de referência.
10. Edite título no Arquivo, repita revisita; mova uma obra ancorada depois de reconhecer; exclua uma obra e confirme que desapareceu em novas sessões.

## 3. Critérios de aceite

- [ ] UI identifica build VPS vs local sem revelar a chave.
- [ ] Scan status vem do renderer nativo e atende limites de keyframes/pares/dispersão.
- [ ] Hosting retorna ID e transformada válidos (TTL da POC: 7 dias).
- [ ] O app guarda ID, frame e posições relativas localmente, sem sobrescrever dados de teste antigos.
- [ ] Ao reiniciar a câmera, o ReactVision **reconhece** o lugar antes de renderizar as intervenções ancoradas.
- [ ] Não há exibição falsa das intervenções antigas sem `locationPosition`.
- [ ] Texto editado persiste e é refletido na RA após revisita.
- [ ] Erros de rede, autenticação, cotas, mapa não encontrado e expiração são visíveis.
- [ ] Após desligar a rede, **não** fingimos que o reconhecimento cloud funcionou.
- [ ] QA iPhone físico; Android só quando houver aparelho ARCore certificado.

## 4. Limites e custos

O ReactVision hospeda descritores visuais e calcula/recupera a referência espacial. A **nossa** futura infraestrutura (Supabase + Storage) poderá hospedar nomes de lugares, identificadores de âncora, direitos de publicação, textos, fotos e posições das obras; **isso não é, por si só, um VPS**. Para substituí-lo totalmente, será preciso reconstrução de características visuais, triangulação, correspondência, estimação de pose e controle de mapa.

Nesta POC não temos sincronização de obras entre aparelhos nem publicação em nuvem. Mesmo que um segundo telefone resolva o ID da âncora, só verá os textos se também receber os metadados autorizados da nossa aplicação.

O plano grátis possui limites de API e armazenamento, visíveis no ReactVision Studio. Operações de Cloud Anchor consomem cota; se ela se esgotar, o servidor responde com erro. Evite scans repetidos desnecessários. A validade de 7 dias é apenas para QA, não para `Memor Brasília` permanente.

**Privacidade:** não hospedar espaços privados ou rostos/pessoas sem consentimento. Usar ambiente de teste autorizado. Chaves públicas são legíveis por todo usuário do app, portanto autorizações e operações administrativas exigirão backend com autenticação e controles independentes.

## 5. Logs para compartilhar

Registrar: versão do dispositivo, iOS/Android, resultado das contagens do scan, tempo de hosting, `cloudAnchorId` reduzido, data de expiração, tempo para relocalizar e erros retornados. Não colar `rv_secret_` em logs.

## 6. Fontes técnicas

- https://viro-community.readme.io/docs/vps
- https://viro-community.readme.io/docs/client-keys
- https://viro-community.readme.io/docs/integrating-with-expo
- https://github.com/ReactVision/viro/blob/main/components/AR/ViroLocationFrame.ts

Não fazer merge antes de passar por QA em hardware e CI.
