# Memor QA · matriz de testes

Build experimental: `com.espindola.memor.app.qa`, versão 0.1.0.
Executar em iPhone físico com ARKit e Android físico compatível com Google Play Services for AR / ARCore.

## Testes funcionais

| ID | Cenário | Esperado |
| --- | --- | --- |
| UI-01 | Instalar e abrir | Lista de locais sem erros |
| UI-02 | Criar local com nome válido | Detalhes abrem com 0 intervenções |
| UI-03 | Nome só com espaços | CTA bloqueado, não cria |
| UI-04 | Fechar/reabrir app | Cadastro local ainda aparece |
| UI-05 | Excluir local | Removido do aparelho após confirmação |
| AR-01 | Abrir laboratório | Camera AR funciona em hardware suportado |
| AR-02 | Apontar para piso texturizado | Raycast usa vetor real da câmera; pode retornar plano medido, DepthPoint ou estimativa identificada |
| AR-03 | Não há plano sob a mira | Exibir contagem/tipos nativos do último hit test; sem plano, profundidade ou estimativa, bloquear posicionamento |
| AR-04 | Criar Texto 3D | Aparece na pose escolhida e no arquivo de rascunhos |
| AR-05 | Criar Cartão | Aparece suporte expositivo simples; ainda não é foto real |
| AR-06 | Alternar Criar → Visualizar | Objetos mantêm posição **na mesma sessão** |
| AR-07 | Circular ao redor | Medir deriva visual e erros |
| AR-08 | Sair e reentrar na câmera | Rascunhos seguem na lista, mas **não aparecem em RA** sem relocalização real |
| AR-09 | iPhone vs Android | Testar fluxos separadamente; nenhum compartilhamento implementado |
| AR-10 | Abrir AR em device sem suporte | Registrar erro de compatibilidade; não marcar como válido |
| PRIV-01 | Observar rede e Supabase | Nenhum upload, publicação ou sincronização efetuados |

## Coleta de métricas manual

- Modelo do aparelho, iOS/Android e versão.
- Tempo de abertura AR e até primeiro plano encontrado.
- Tempo até primeira intervenção visível.
- Desvio aproximado em cm após caminhar 1, 3 e 5 m (usar ponto físico como referência).
- Travamentos e mensagens de permissão.
- Capturas de tela (somente com consentimento quando houver pessoas).
- Consumo de bateria e aquecimento, se observáveis.

## Comandos

```sh
npm install
npm run test
npm run typecheck
npx expo install --check
npx expo prebuild --clean
npx expo run:ios --device
# ou npx expo run:android --device
```

**Nota:** GitHub Actions valida somente testes TS/domínio e typecheck (quando configurado). Build/assinatura e câmera RA devem ser testados em dispositivo físico. Não registrar este protótipo como aprovado sem os dois.

### Diagnóstico iPhone / superfície horizontal

- Apontar para um detalhe texturizado da parede ou piso antes de testar a cama, aguardando **RASTREAMENTO ATIVO** e **DIREÇÃO DA CÂMERA: OK**.
- Inclinar a câmera para a cama; a direção do raycast deve acompanhar a inclinação real (não usar `[0,0,-1]` constante).
- Anotar **ÚLTIMO TESTE**: `ExistingPlane*` indica plano reconhecido; `DepthPoint` indica profundidade LiDAR; `EstimatedHorizontalPlane` é posição provisória; `FeaturePoint` sozinho não basta.
- Se `0 resultados` e `PROFUNDIDADE: PENDENTE`, registrar o log de ARKit `poor slam` / `Frame has no valid depth` e testar novamente com boa luz, movimento lento e superfícies com contraste.
- Repetir com mesa rígida e cama, pois superfícies macias/texturalmente uniformes podem não gerar planos reconhecidos com a mesma confiabilidade.
- Confirmar que a mensagem de sucesso **não afirma plano confirmado** ao usar estimativa ou profundidade.
