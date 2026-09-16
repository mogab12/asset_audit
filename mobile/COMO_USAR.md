# Auditoria de Ativos (celular): guia de instalação e uso

Versão do aplicativo que roda **dentro do próprio celular**, sem precisar de
computador, rede Wi-Fi nem internet no dia a dia da auditoria — e com acesso à
câmera para ler o QR code do Effort. É a mesma lógica da versão de computador
(`app/`), reescrita para funcionar 100% no navegador do celular, com os dados
guardados no próprio aparelho (IndexedDB).

**Diferença importante em relação à versão de computador:** aqui cada celular
guarda os seus próprios dados. Não há mais um servidor único compartilhado por
vários aparelhos em tempo real — juntar o trabalho de vários auditores continua
sendo feito por **exportar/importar planilha**, exatamente como já funciona
hoje (seção 5).

## 1. Primeiro carregamento (só uma vez)

Para virar um aplicativo instalável e 100% offline, o celular precisa abrir a
página **uma única vez** por algum servidor local — depois disso, o ícone
instalado funciona sem rede nenhuma. Duas formas de fazer esse primeiro carregamento:

### Opção A — pelo Wi-Fi do local (mais simples)

1. Em um computador (o mesmo usado para a versão de mesa serve), abra um terminal
   dentro da pasta `mobile/` e rode:
   ```
   python -m http.server 8000
   ```
2. Descubra o IP do computador na rede (`ipconfig` no Windows, `ip a` no
   Linux/macOS) e, no celular **conectado à mesma rede**, abra
   `http://SEU_IP:8000` no Chrome.
3. Siga para a seção 2 (instalar).

### Opção B — por cabo USB, sem usar nenhuma rede (`adb reverse`)

Para quem não quer depender nem de uma rede Wi-Fi local, dá para carregar a
página só com um cabo USB e o Android SDK Platform Tools (`adb`):

1. Ative a "Depuração USB" no celular (Ajustes > Opções do desenvolvedor).
2. No computador, dentro de `mobile/`: `python -m http.server 8000`
3. Com o celular conectado por USB: `adb reverse tcp:8000 tcp:8000`
4. No navegador do celular, abra `http://localhost:8000`.

## 2. Instalar como aplicativo

No Chrome do celular, toque no menu (⋮) e em **"Instalar aplicativo"** (ou
"Adicionar à tela inicial"). Um ícone "Auditoria de Ativos" aparece na tela
inicial, abrindo em tela cheia, sem a barra de endereço do navegador.

Depois de instalado, ative o modo avião e confirme que o aplicativo continua
abrindo e funcionando normalmente — é o sinal de que ficou 100% offline.

Na primeira abertura, o Chrome vai pedir permissão de **câmera** quando você
tocar em "Ler QR code" pela primeira vez. Toque em Permitir.

## 3. Usar

O funcionamento é idêntico à versão de computador (veja `COMO_USAR.md` da raiz
do projeto para o passo a passo completo de auditoria, TAGs fora do padrão
etc.). Resumo:

1. Em **Planilhas**, importe a planilha exportada pelo Effort.
2. Toque no nome no topo e informe quem está auditando.
3. Escolha um setor, pesquise ou abra os itens pendentes, e registre a
   situação de cada equipamento.
4. Use **Ler QR code** para apontar a câmera para a etiqueta do Effort e
   registrar automaticamente.

## 4. Cada celular com seus próprios dados

Diferente da versão de computador, aqui não existe "um banco só" compartilhado
ao vivo entre aparelhos. Cada celular:

- Importa a mesma planilha do Effort no início da auditoria.
- Audita os equipamentos normalmente, salvando tudo localmente.
- No fim, usa **Planilhas > Exportar planilha** para gerar o arquivo
  `Auditoria_de_Ativos_NOME_DATA.xlsx`.

Depois, em qualquer aparelho (celular ou o computador com a versão Flask),
importe **todos** os arquivos exportados de uma vez (modo **Juntar**) para
consolidar o trabalho de todos — as regras de conflito são as mesmas descritas
na seção 5 do `COMO_USAR.md` da raiz.

## 5. Apagar dados / recomeçar

Em **Planilhas > Apagar base**, digite `APAGAR` para confirmar. Isso limpa
todos os equipamentos e conflitos guardados neste celular (a base de
referência do Effort, usada pelo leitor de QR code, não é apagada).

Se quiser remover o aplicativo por completo, desinstale-o como qualquer app
(segurar o ícone > Desinstalar). Isso também apaga os dados guardados nele.

## 6. Atualizar o aplicativo depois de uma alteração no código

O aplicativo guarda uma cópia de todos os arquivos (`service-worker.js`) para
funcionar offline. Depois de alterar qualquer arquivo em `mobile/`, aumente o
número em `const VERSAO = "v1"` no topo de `service-worker.js` — isso avisa o
celular que existe uma versão nova para baixar da próxima vez que abrir com
internet/rede disponível (repita o primeiro carregamento da seção 1).

## 7. Testes automatizados

As regras de negócio (validação de TAG, mesclagem de planilhas, leitura/escrita
de Excel) têm testes em `tests/logica.test.mjs`, equivalentes aos de
`tests/test_regras.py` na raiz. Para rodar (precisa de Node.js 18+):

```
cd mobile
node --test tests/logica.test.mjs
```

## 8. Limitações conhecidas desta primeira versão

- Só foi testado no Chrome para Android. Deve funcionar em outros navegadores
  baseados em Chromium; no Safari/iOS o suporte a "instalar como app" e à
  câmera pela web é mais limitado.
- Não gera um `.apk` — o "aplicativo" é a página instalada pelo navegador. Dá
  para empacotar num `.apk` de verdade depois (ex.: com Capacitor), reusando
  todo este código sem reescrever nada.
- Sem sincronização em tempo real entre celulares — combinado com o pedido de
  funcionar sem rede/nuvem (veja a seção 4 acima).
