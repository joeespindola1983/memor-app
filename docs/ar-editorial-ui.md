# Memor · Interface editorial para criação e revisita (2026-11-06)

Branch `feat/memor-ar-editorial-ui` — baseada em `feat/memor-reactvision-vps-poc`.
Referência visual: Figma `8Hz0SWIYAlxVEtRRWM6VEW`.

## Nós de referência

- `73:1056` — AR / Mapeamento guiado: câmera full bleed, header de papel de 70 px, HUD no rodapé e CTA único
- `114:1975` — AR / Orientação e posicionamento: cabeçalho compacto, câmera como protagonista, um gesto principal
- `109:1744` — Nome do lugar: formulário sem AR, tipografia editorial e botão primário
- `109:1768` — Lugar salvo: estado de sucesso e convite para abrir a câmera
- `9:2` — Foundations: papel `#F4F2EC`, tinta `#161615`, linha `#D8D7D1`, acento lime `#A5EC31`, DM Sans e Silkscreen como referências tipográficas. O código atual reaproveita os tokens e o fallback monospace de `PixelLabel`; fontes customizadas precisam de asset/licença/configuração próprios para paridade perfeita.

## Interface visível

1. **Captura:** ao iniciar o tracking normal, o Memor chama `startScan()` automaticamente quando a integração VPS está ativa. Orientação humana, três marcas discretas de cobertura, botão `GUARDAR LUGAR` que chama `finishScan(7)`. Sem conceitos de keyframes, planos, depth, cloud ou percentual de qualidade. **Hospedagem continua sendo uma ação explícita**.
2. **Nome:** AR descarregada, campo grande, confirmação breve, localização opcional e `SALVAR LUGAR`. O código continua salvando `CaptureEvidence` e `HostedVPSAnchor`, sem mostrar IDs.
3. **Lugar salvo:** título e obras, um CTA para entrar na RA, relação editorial. Expiração da referência é comunicada como necessidade de nova captura, não com TTL ou nome do provedor.
4. **Intervenção AR:** folha compacta no rodapé, alternância `CRIAR` e `VER INTERVENÇÕES`, campo de texto e uma ação de colocação/movimento. Nenhuma leitura do sensor, diagnóstico ou nome de framework visível.
5. **Arquivo / perfil / editor:** terminologia sem QA. Diagnósticos continuam em logs dev e bridges internos.

## Guardrails de funcionalidade

- **Não** remover `cloudAnchorId`, `locationPosition` nem as matrizes do modelo salvo.
- Só permitir novo posicionamento persistente quando `tracking.anchorLocalized`.
- Não exibir intervenções antigas sem frame como se tivessem sido relocalizadas.
- Não confundir o cartão de demonstração com uma fotografia enviada. O fluxo de criação visível nesta etapa é texto.
- Sem publicação automática no Supabase; o app ainda salva intervenções só no aparelho.
- Não apagar o app para testar: rascunhos estão em AsyncStorage.
- O Figma ainda contém fluxos editoriais de referência mais amplos; esta branch é uma implementação do escopo iPhone de captura e visualização, não toda a migração do design system.

## QA físico

```bash
git fetch origin
git switch feat/memor-ar-editorial-ui
git pull --ff-only
npm install
npm test
npm run vps:doctor
npx expo start --dev-client --lan --clear
```

**Um rebuild nativo normalmente não é necessário**: não há novos pacotes nativos nem mudanças no plugin Expo; usar o mesmo app QA já compilado para `provider=reactvision` e recarregar o JS. Caso as credenciais nativas tenham mudado, refazer `expo prebuild` e build.

Checklist:
- [ ] A câmera ocupa a tela e o HUD não tapa a mira.
- [ ] Não são exibidos rótulos de QA, VPS, tracking, depth ou números técnicos.
- [ ] O mapeamento inicia automaticamente após tracking normal.
- [ ] `GUARDAR LUGAR` habilita somente após cobertura suficiente e executa hosting ao tocar.
- [ ] O nome pode ser digitado sem a cena AR ativa.
- [ ] O lugar aparece no Arquivo com título e contador correto.
- [ ] Na primeira abertura, localizar lugar, criar texto, sair e reabrir no mesmo local.
- [ ] Não mostrar obra antes de o ReactVision confirmar a relocalização.
- [ ] Testar erro de conexão, lugar ainda não encontrado, falha de hosting.
- [ ] Testar teclado e área segura no iPhone 15 Pro Max, inclusive com lista de obras.

## Verificação

A inspeção do log anexado confirma `provider=reactvision`, upload de features com HTTP 201, criação de cloud anchor com HTTP 201 e duas requisições de resolução relatadas como `success=true`. Isso não valida precisão espacial em centímetros, qualidade visual ou estabilidade de relocalização no campo.

Este PR **não foi compilado nem testado em aparelho** neste ambiente. O teste `tests/ui-surface.test.mjs` é uma trava de regressão textual; não substitui TypeScript, testes de interação e QA visual.
