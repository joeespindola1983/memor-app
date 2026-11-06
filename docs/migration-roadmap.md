# Memor — plano de migração SwiftUI → React Native

**Decisão de produto (2026-11-05):** `memor-app` é a nova base iOS/Android, **sem fallback de realidade aumentada para Androids não certificados pelo ARCore** nesta fase. O `memor` em SwiftUI permanece como referência funcional e fonte de contratos até que cada feature tenha QA equivalente. Nenhum artefato `ARWorldMap` é convertido implicitamente.

**Repositório de referência:** [joeespindola1983/memor](https://github.com/joeespindola1983/memor), revisão de estudo `b4b60d132223f673a1d075d4d9e8959c7afc4d67` (`feat/memor-progressive-world-mapping`).
**Repositório de produto:** [joeespindola1983/memor-app](https://github.com/joeespindola1983/memor-app).
**Base deste incremento:** `feat/react-native-ar-lab`; QA `com.espindola.memor.app.qa`.

## Princípios / invariantes

1. Lugar físico, intervenção individual e coleção editorial são entidades distintas. A intenção de enviar **uma obra** a uma coleção **nunca** publica o mapa, nem as demais obras.
2. `Memor Brasília` representa projeto/acervo curado, de preservação sem expiração automática. `Brasília Aberta` é nome **de trabalho** para canal comunitário sujeito à moderação.
3. Registros sem vínculo editorial só aparecem em **TODOS**. Não atribuir coleções por inferência, nem fabricar aprovações.
4. Conteúdo local é privado até que fluxo específico de consentimento, autorização, revisão, RLS e publicação real esteja implementado.
5. A pose de uma sessão AR não é uma âncora persistente: sair do laboratório invalida a visualização da pose antiga. Persistência e relocalização são histórias diferentes.
6. iOS/Android compartilham UI e regras TypeScript; `ViroReact` encapsula ARKit/ARCore, mas `ARWorldMap` continua específico do iOS. Não prometer importação.
7. A experiência Android de RA exige aparelho **certificado ARCore**. Galaxy A06 não integra a matriz de QA de RA. QR/marcadores e modo alternativo ficam fora do escopo atual.
8. Nenhuma escrita em Supabase de produção/QA até termos contrato, políticas RLS, testes de permissão e ambiente configurado explicitamente.
9. Testes de domínio/contrato em CI; aceitação de RA e mapas exige dispositivos físicos, não apenas compilação.

## Fases e critérios de aceite

| Fase | Escopo | Critério de aceite | Estado |
|---|---|---|---|
| 0 — Laboratório de RA | Expo 57, ViroReact 3.0.3; criação e visualização de texto/cartão na **mesma sessão** | iPhone físico confirmou criação/visualização; build Android compatível pendente | **Validado no iOS; QA Android pendente** |
| 1 — Navegação, visual e domínio | Tokens Figma/SwiftUI, Header, Mapa, Arquivo, Criar, Eu, coleções, rascunhos editoriais locais, localização opt-in | Navegar sem telas inertes; rascunhos só por obra existente; filtros não inventam conteúdo; teste de navegação em iOS/Android | **Em implementação nesta branch** |
| 2 — Capture/Place v2 | Varredura Viro, nomeação com RA desmontada, cadastro, edição/exclusão de obras; relocalização espacial ainda requer serviço | QA físico de tracking/edição; persistência do mapa depende de VPS | **Primeiro incremento na branch feat/memor-capture-edit-flow; QA e VPS pendentes** |
| 3 — Mídia e UX artística | Fotografia real, preview, galeria, estandes, texto, redimensionamento; gerência de câmera e sessões | Foto/nomeamento preservados; RA pausa antes da câmera nativa; recaptura e exclusão testadas | **Não iniciado** |
| 4 — Relocalização multiplataforma | `SpatialLocalizationProvider`; avaliar Viro Cloud Anchors / VPS, TTL, preço, limites e privacidade; âncoras relativas à origem compartilhada | iPhone cria → Android reconhece → volta outro dia, com erro e tempo medidos | **Pesquisa / POC pendente** |
| 5 — Persistência e sincronização | Clientes Supabase, auth única, esquemas e RLS compatíveis, backup privado vs publicação; migrações aprovadas | E2E dois usuários: isolamento privado, exclusão e revisão editorial validadas | **Não iniciado** |
| 6 — Mapeamento avançado | Revisões/expansão de mapas, modo de captura leve, ARReferenceImage/objetos e recuperação de snapshots; analisar equivalentes Android | Testes sem perda de âncoras, falha offline e recuperação documentados | **Não iniciado** |
| 7 — Estabilização e lançamento | E2E, testes instrumentados, métricas, acessibilidade, i18n, distribuição TestFlight/Play Internal | Critérios de qualidade por plataforma e release checklist | **Não iniciado** |

A ordem é intencional: colocar o produto de pé sem converter `ARWorldMap` em falsos IDs cross-platform. Implementações SwiftUI ainda em PRs draft não são consideradas release certificada.

## Contratos a migrar da fonte SwiftUI

- `MemorTokens`: papel `#F4F2EC`, mapa `#ECEAE4`, tinta `#161615`, linha `#D8D7D1`, estados de mídia específicos.
- `MemorRootView`: header global + bottom navigation `MAPA / ARQUIVO / CRIAR / EU`. Criar é **ação**, não aba inerte.
- `MemorMapScreen`: MapKit, localização opt-in, raio 500 m, filtros TODOS/PROJETOS/COMUNIDADE; apenas coleções com associação real podem aparecer no filtro.
- `MemorArchiveScreen`: **todos** os lugares salvos, mesmo sem obras/coordenada, exclusão explícita.
- `MemorEditorialCollection`: IDs, labels, regras e acervo `memor-brasilia` / `brasilia-aberta`.
- `MemorEditorialDraftRepository`: rascunho de **uma obra** e seu destino; save privado, upsert, delete, validação da existência da obra.
- `MemorProfileScreen`: lugares pessoais, coleções e acesso aos rascunhos.
- `ARExperienceController` e `MemorCaptureFlowView`: serão migrados por comportamento/teste, **não** convertidos linha-a-linha.

## Limites desta primeira fase

**Implementado inicialmente:** navegação/produto, mapa geolocalizado com pins apenas de obras locais elegíveis, criação de lugar com localização opt-in, arquivo local, detalhes, coleção editorial e rascunhos de intervenções do tipo **texto**. `card` é um cartão de QA e **não é** fotografia real; portanto não pode ser publicado/associado editorialmente até termos a fase de mídia.

**Não implementado:** conteúdo remoto, autenticação, upload, moderação, requisições de revisão, sincronização, ARWorldMap, upload de fotos, QR, identificação de celulares não-ARCore.

## Passos para QA

```sh
git fetch origin
git switch feat/memor-product-migration-foundation
npm install
npm run test
npm run typecheck
npx expo install --check
npx expo prebuild --clean --platform ios
npx expo run:ios --device
```

**Após adicionar módulos nativos (`react-native-maps`, `expo-location`), reconstruir o app**, não apenas recarregar Metro. No Android, Google Maps requer chave própria de Maps SDK no build; nunca versionar chave sem restrições. O laboratório AR continua dependente de dispositivo físico certificado.

## Entrega M2 — status preciso

- Implementado: fluxo de captura por observação, coleta de tracking/plano/depth, nomeação sem câmera, catálogo local, criação/visualização de textos e cartões QA, reposicionamento de obra da sessão atual, edição de metadados e exclusão por obra/lugar.
- Sem promessa de relocalização: `CaptureEvidence.kind=tracking-observation-v1` não contém `ARWorldMap`, imagem de referência ou VPS; seu objetivo é preservar sinais de qualidade e testar o UX multiplataforma.
- Em espera: varredura 3D persistente, importação de mapas antigos, sincronização, fotografia real e revisita cruzada iOS/Android.
- O contrato `SpatialLocalizationProvider` está documentado no código, e a implementação padrão rejeita tentar capturar/resolver âncoras sem provedor configurado.
- Critérios e logs para testar: [docs/capture-edit-qa.md](capture-edit-qa.md).
