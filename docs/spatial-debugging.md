# Memor — rastreabilidade espacial e teste de fotos

Branch: `feat/memor-offline-worldmap`. Expo/React Native + módulo Swift ARKit.

## Diagnóstico do teste de 6 novembro 2026

- O Xcode registrou `Registering module 'MemorWorldMap'`, indicando que o binário continha o módulo.
- O log mostrou `World tracking performance is being affected by resource constraints [33]` e diversas mensagens dos subsistemas Apple de câmera. Isso não prova por si só falha ao salvar texto.
- Faltavam logs de operações da aplicação (`placeText`, criação de `ARAnchor`, `renderer`, commit do mapa). **O log não permite concluir se a âncora foi salva ou se apenas não foi desenhada.**
- No código antigo, o `renderer(nodeFor:)` tentava buscar o texto no dicionário antes de `placeText` atualizá-lo, criando nó vazio. Além disso, usava fonte branca de tamanho muito pequeno. Ambos foram corrigidos.

## Nova experiência

1. Abrir um lugar salvo; apontar para o local original e aguardar reconhecimento.
2. Digitar texto; mirar uma região com referências; selecionar **Deixar texto aqui**.
3. A referência espacial é salva como `ARAnchor` nativa. O SceneKit recebe o conteúdo antes de renderizar e também atualiza os nós quando os metadados chegam tarde.
4. Para foto, escolher **Capturar foto** (câmera nativa do iOS, via Expo ImagePicker), fotografar e retornar ao Memor. O ARKit é pausado durante o uso da câmera.
5. **Reconhecer o lugar novamente** após voltar da câmera, mirar a superfície e tocar **Fixar foto na mira**. A foto privada em JPEG e sua âncora AR são salvas no mesmo diretório do mapa.
6. Fechar, reabrir e conferir a obra no mesmo lugar.
7. Usar **Exportar histórico de depuração** (na parte inferior da experiência AR) e compartilhar o texto com os registros de eventos.

**Privacidade:** `MemorSpatialTrace` guarda eventos, horários, IDs opacos, bytes, estados de tracking e resultados. Não inclui textos, pixels das fotografias, coordenadas geográficas ou chaves de autenticação. O histórico fica no sandbox do aplicativo e ocupa no máximo aproximadamente 250 KiB; registros antigos são aparados.

## Logs importantes

| Etapa | Evento esperado |
|---|---|
| Abrir experiência | `session.open`, `map.restore.loaded` |
| Reconhecer | `tracking.changed` (`localized: true`) |
| Adicionar texto | `rn.text.started`, `text.anchor.adding` |
| Texto persistido | `text.anchor.saved`, `rn.artwork.metadata.saved` |
| Texto visível | `render.anchor.attached`, `render.node.attached` |
| Fotografia | `photo.camera.paused`, `rn.photo.camera.captured`, `photo.camera.resuming` |
| Fixar fotografia | `photo.anchor.added`, `photo.anchor.saved`, `render.node.attached` |
| Erros | `*.failed`, `render.metadata.missing`, `render.asset.unavailable` |

Os logs `[Memor][Spatial]` aparecem no Xcode. Os `[Memor][RN]` aparecem no Metro/Xcode. O arquivo `Documents/MemorLogs/spatial.jsonl` persiste entre aberturas do app e é compartilhado com **Exportar histórico de depuração**.

## Validar no Mac

```bash
git fetch origin
git switch feat/memor-offline-worldmap
git pull --ff-only
npm install
npm run native:check
npm run typecheck
npm run test
npx expo prebuild --clean --platform ios
npx expo run:ios --device
```

Adicionar `expo-image-picker` exige **novo build iOS nativo**; Metro/fast refresh não instala Pods Swift. Não desinstalar o QA existente para preservar dados locais.

Não usar a presença do mapa ou dos arquivos como prova de reconhecimento interdispositivos. Android e Supabase continuam pendentes.
