# Memor QA — captura e edição de lugares (M2, primeira entrega)

**Branch:** `feat/memor-capture-edit-flow` (base `feat/memor-product-migration-foundation`).  
**Assinatura:** `com.espindola.memor.app.qa`.
**Artefatos de dados:** somente AsyncStorage no sandbox do app.

## Fluxo a testar no iPhone

1. **Mapa / Arquivo → CRIAR**: abre câmera AR; observar rastreamento, planos, profundidade, distância aproximada percorrida.
2. Mover lentamente ao redor da escultura, mesa ou monumento. Com tracking normal, aproximadamente 25 cm percorridos e ao menos um plano **ou** profundidade disponível, `CONCLUIR VARREDURA` passa a ficar acessível. A contagem é apenas uma heurística de observação.
3. **Concluir varredura** desmonta o `ViroARSceneNavigator`. A próxima tela recebe metadados da observação em memória, não um mapa espacial.
4. **Nomear lugar**: digitar, opcionalmente permitir GPS, salvar. Não há RA montada durante a digitação.
5. **Detalhes**: observar banner `LOCAL REGISTRADO`, indicadores da varredura, aviso de que a captura não é relocalizável.
6. **Abrir RA**: criar texto 3D e/ou cartão QA mirando plano ou profundidade; alternar `CRIAR / VISUALIZAR` sem resetar a sessão.
7. **Mover obra**: no modo Visualizar escolher uma obra criada na mesma sessão, apontar para outra posição e tocar `MOVER PARA A MIRA`; conferir a mudança.
8. **Sair da RA**: no Arquivo, abrir o lugar e tocar uma intervenção para editar título e salvar. Confirmar mudança mesmo após reiniciar app.
9. **Excluir uma intervenção**: confirmar e verificar contagem atualizada. Excluir um rascunho editorial vinculado, quando existir.
10. **Excluir o lugar**: confirmar; verificar que o item desapareceu do Arquivo e não retorna após reiniciar. Observar que rascunhos editoriais não aparecem órfãos.
11. **Reabrir o lugar em RA**: confirmar que obras antigas **não** são desenhadas com origem arbitrária. O app não pode declarar que reconheceu um lugar antigo.

## Limitações visíveis por design

- **Não há ARWorldMap salvo**, nem mapa persistente, nem VPS, nem Cloud Anchors. `CaptureEvidence` apenas registra a qualidade e as condições de uma observação espacial feita no dispositivo.
- `sessionPosition` de uma obra serve para renderizar somente na sessão em que foi criada. Ao voltar à RA, as obras continuam como metadados no Arquivo, sem pose visual confirmada. Não é possível editá-las espacialmente até haver relocalização.
- A distância explorada é uma aproximação calculada pela translação da câmera (em metros), com descarte de saltos incompatíveis. **Não** representa qualidade equivalente a `worldMappingStatus.mapped` do ARKit.
- Cama, bancos e superfícies irregulares não precisam produzir plano horizontal; profundidade permite uma observação experimental, identificada como tal.
- Cartões QA ainda **não** são fotos reais. Captura de JPEG, estandes e workflows de mídia estão na etapa M3.
- Android com RA: apenas dispositivos com suporte oficial ao ARCore. Galaxy A06 não é aparelho de QA espacial.
- Nenhum upload para Supabase, sincronização, publicação, vínculo editorial automático ou importação de capturas SwiftUI.

## Checklist técnico

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

Se o app da etapa M1 já está instalado com `react-native-maps` e `expo-location`, as mudanças desta feature são majoritariamente TypeScript. Todavia, **o primeiro teste da branch exige build nativo** porque M1 ainda não teve QA físico confirmado. Não apagar app QA antigo se precisar preservar rascunhos existentes.

## Métricas desejadas

- Modelo iPhone, versão iOS; número de planos, aviso de profundidade, segundos de tracking, distância explorada.
- Latência para liberar `CONCLUIR VARREDURA`, erros de ARKit, aquecimento.
- Comportamento da câmera ao abrir o teclado durante nomeação (ela deve estar desmontada).
- Tempo de posicionamento, estabilidade ao mover a obra e comportamento de exclusão.
- Se houver crash, fornecer log Xcode completo e tela que estava aberta.

## Etapas posteriores

- Implementar provedor de âncoras que realmente suporta **relocalização entre sessões**.
- Captura de fotos reais e edição de instalações.
- Estado editorial e publicação por obra depois do desenho RLS e Supabase QA.
