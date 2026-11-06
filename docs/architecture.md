# Memor App · arquitetura do experimento RN / ViroReact

## Problema que queremos provar

Dois dispositivos, um iPhone e um Android, devem ser capazes de criar e visualizar uma intervenção espacial em um lugar físico. Antes de investir em VPS ou cadastro completo de artistas, testamos se a mesma UX de RA pode ser implementada com React Native + ViroReact nos dois sistemas.

## Decisão técnica da etapa 1

- **UI:** Expo Router + React Native + TypeScript; design minimalista com etiquetas monoespaçadas, componentes reutilizáveis e tokens.
- **AR:** ViroReact 3.0.3 (`ViroARSceneNavigator` + `ViroARScene`), usando ARKit/ARCore através do SDK.
- **Provedor de localização compartilhada:** `none`. Não criar credenciais de terceiros ou simular cloud anchors.
- **Persistência de rascunhos:** AsyncStorage (chave `@memor-qa/ar-lab-places-v1`), local e não criptografado. Nenhum dado privado sensível.
- **Plano de trabalho:** um único AR navigator vive na tela do laboratório; o usuário muda Criar/Visualizar na sobreposição React Native sem destruir a sessão.
- **Posicionamento:** hit test para `ExistingPlaneUsingExtent` ou `ExistingPlane` a partir do raio central da câmera; o resultado é um ponto AR válido **somente na sessão corrente**.
- **Conteúdo inicial:** texto 3D e cartão expositivo fictício. Não representa fotografia importada, scan 3D, arte aprovada, upload ou publicação.
- **Acesso:** apenas devices físicos com ARKit/ARCore; telas comuns funcionam em outros aparelhos, mas a RA pode estar indisponível.

## Modelos

```txt
LabPlace
  id, title, createdAt, updatedAt
  artworks: ArtworkDraft[]

ArtworkDraft
  id, kind: text|card, title, createdAt
  sessionPosition: [x,y,z]

ARSession
  placeId, key, mode: create|view
  artworks: ArtworkDraft[]  // Apenas a sessão em execução
```

`sessionPosition` **não** é uma âncora persistente. O valor não deve ser automaticamente renderizado numa nova sessão, pois a origem dos eixos é diferente. A lista no Arquivo pode exibir o rascunho como metadado histórico, mas a RA só renderiza objetos criados na sessão ativa.

## Compatibilidade com o Memor original

Os arquivos `.archive` do ARKit e `ARWorldMap` são **compatíveis apenas com a integração iOS nativa original**, não com ARCore de forma automática. Este app **não importa** mapas do SwiftUI. A migração de lugares exigirá uma origem compartilhada e uma matriz de transformação aprovada entre coordenadas.

## Próximas etapas, após testes UI/AR

1. Validar a precisão de hit test e estabilidade de posicionamento em iPhone e Android.
2. Implementar `SpatialLocalizationProvider` com `startCapture`, `savePlaceAnchor`, `resolvePlaceAnchor`, `worldToPlacePose`, `placeToWorldPose`.
3. Comparar ReactVision Spatial VPS com ARCore Cloud Anchors e, se necessário, Immersal. Não escolher fornecedor sem medir precisão, persistência, custos e disponibilidade.
4. Vincular `LabPlace` e intervenções a identificadores e formatos canônicos do Memor via Supabase QA **somente após validação de modelo e RLS**.
5. Implementar seleção de fotografia, armazenamento durável e exposição de imagens reais.
6. Testar relocalização depois de fechar o app, em outro dia e no outro sistema operacional; medir taxa de sucesso e erro em centímetros.
7. Integrar design system completo e moderação com produto original, mantendo o SwiftUI como referência funcional durante a migração.

## O que não avaliar nesta fase

Não avaliar permanência das obras entre sessões, compressão de ARWorldMap, mapeamento progressivo, sincronismo multiusuário, publicação pública, VPS em monumentos ou comparação de hardware. Esses experimentos precisam de uma âncora persistente real.
