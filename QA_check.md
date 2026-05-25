# Checklist de QA - Limpeza Visual da Rodada

## 1) Troca de rodada (fluxo normal)
- Inicie uma rodada, jogue ate `ROUND_END` e inicie outra.
- Validar:
  - nao sobra carta "voando" na tela;
  - banner de vaza anterior some antes da nova rodada;
  - Macaca reinicia visualmente correta;
  - maos dos jogadores refletem apenas a rodada atual.

## 2) Fim de rodada com AFK
- Deixe um jogador AFK ate virar `AWAY`.
- Validar:
  - nao ficam cartas do jogador AFK presas na mesa;
  - nao sobra animacao interrompida;
  - a proxima rodada inicia com mesa visual limpa.

## 3) Virar espectador no meio da rodada
- Clique `Espectar` durante `BETTING` e durante `PLAYING`.
- Validar:
  - mao some de forma limpa;
  - card do jogador fica apenas com estado/tag;
  - nenhum card residual (face-up/back) permanece fora de contexto.

## 4) Retorno na proxima rodada
- Com jogador `AWAY` ou `SPECTATOR`, clique `Voltar`.
- Validar:
  - status `volta na proxima` aparece;
  - jogador nao reaparece visualmente na rodada atual;
  - na proxima rodada ele volta com mao e assento limpos.

## 5) Macaca em todos os fluxos
- Execute uma rodada com `MACACA` e outra sem `MACACA`.
- Validar:
  - pilha da Macaca comeca limpa e enche corretamente no deal;
  - ao pegar Macaca, esvazia visualmente sem "fantasma";
  - entre rodadas nao sobra carta da Macaca.

## 6) Manilha e Fundo
- Observe transicao `ROUND_END` -> nova rodada.
- Validar:
  - manilha/fundo antigos somem antes dos novos;
  - nao aparecem cartas no canto ou em camada errada.

## 7) Overlay de fim de jogo
- Force condicao de `GAME_OVER`.
- Validar:
  - overlay aparece uma unica vez;
  - nao coexistem elementos de rodada ativa com overlay final;
  - ao sair/voltar lobby, a mesa nao reaproveita residuos visuais.

## 8) Reconexao rapida
- Recarregue a aba durante `BETTING` e durante `PLAYING`.
- Validar:
  - layout recomposto sem cartas duplicadas;
  - sem animacoes "atrasadas" apos reconnect.

## 9) Mobile / responsivo
- Repetir ao menos 2 cenarios acima em viewport menor.
- Validar:
  - overlays nao ficam fora da mesa;
  - pote/manilha/macaca nao sobrepoem indevidamente.

## Criterio de aceite (passa/falha)
- Passa se em todos os cenarios houver:
  - zero carta residual;
  - zero animacao fantasma;
  - estados visuais sempre coerentes com `phase` e status do jogador.
