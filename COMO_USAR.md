# Auditoria de Ativos: guia de instalação e uso

Aplicativo local para inventário de equipamentos hospitalares, compatível com as planilhas exportadas pelo Effort (GlobalThings). Os dados ficam gravados no próprio computador, então registrar um equipamento é imediato e não depende de internet.

## 1. O que é preciso

Um computador com Windows, Linux ou macOS e o **Python 3.10 ou superior**. A internet só é necessária na primeira execução, para baixar as dependências (Flask, openpyxl, xlrd e waitress, cerca de 10 MB).

Para instalar o Python no Windows, baixe o instalador em https://www.python.org/downloads/ e, na primeira tela, marque a opção **"Add python.exe to PATH"** antes de clicar em *Install Now*. Sem essa opção, o script de inicialização não encontra o Python.

Para conferir se deu certo, abra o Prompt de Comando e digite `python --version`. Deve aparecer algo como `Python 3.12.x`.

## 2. Primeira execução

Extraia o arquivo `auditoria_ativos.zip` em uma pasta fixa, por exemplo `C:\auditoria_ativos`. Evite deixar dentro da pasta Downloads ou em pastas sincronizadas com OneDrive, que podem bloquear o banco de dados.

**No Windows**, dê duplo clique em `iniciar_windows.bat`. Na primeira vez ele cria um ambiente isolado (pasta `.venv`) e instala as dependências, o que leva um ou dois minutos. Em seguida o navegador abre sozinho em `http://127.0.0.1:5000`. Nas próximas vezes, a abertura é imediata e não precisa de internet.

**No Linux ou macOS**, abra um terminal na pasta e rode:

```
./iniciar_linux_mac.sh
```

Depois abra `http://127.0.0.1:5000` no navegador.

A janela preta do terminal precisa ficar aberta enquanto o aplicativo estiver em uso. Para encerrar, feche essa janela ou pressione `Ctrl+C` nela.

### Instalação manual (caso o script não funcione)

Abra um terminal dentro da pasta do projeto e execute:

```
python -m venv .venv
.venv\Scripts\activate          (Windows)
source .venv/bin/activate       (Linux/macOS)
pip install -r requirements.txt
python run.py
```

Se a rede do hospital usar proxy, a instalação pode falhar. Nesse caso, use `pip install --proxy http://usuario:senha@proxy:porta -r requirements.txt` ou peça ao setor de TI para liberar o acesso a `pypi.org` e `files.pythonhosted.org`.

## 3. Usar pelo celular ou tablet

Ao iniciar, o terminal mostra dois endereços:

```
Neste computador:        http://127.0.0.1:5000
Celular/tablet na rede:  http://10.0.0.25:5000
```

Com o celular conectado à **mesma rede Wi-Fi** do computador, basta abrir o segundo endereço no navegador do celular. Assim um notebook pode servir de base enquanto o auditor percorre os setores com o celular.

Se não abrir no celular, verifique três pontos: o Firewall do Windows pode estar bloqueando (na primeira execução, clique em "Permitir acesso" quando ele perguntar); algumas redes de visitantes isolam os aparelhos entre si; e o computador não pode entrar em suspensão durante o uso.

## 4. Fluxo de trabalho

### 4.1 Preparar a auditoria

1. No Effort, exporte a auditoria em Excel.
2. No aplicativo, abra **Planilhas**, selecione o arquivo, escolha **Substituir** e clique em **Importar planilhas**.
3. Clique no nome no canto superior direito e informe o seu nome completo. Ele será gravado na coluna *Executante*.

### 4.2 Auditar um setor

Na tela inicial, escolha o setor. A lista mostra os itens pendentes; use as abas para ver os auditados ou todos.

Pesquise por **TAG, patrimônio, número de série ou nome** do equipamento. A pesquisa ignora maiúsculas, acentos, espaços e pontuação, então `binf0321`, `BINF-0321` e `Binf 0321` encontram o mesmo item. Várias palavras podem ser combinadas, como `balanca toledo`.

Leitores de código de barras funcionam como teclado: com o cursor no campo de pesquisa, basta ler a etiqueta. Se o código corresponder exatamente a um item pendente do setor, o formulário de auditoria abre direto.

**Quando o item não está no setor:** se a pesquisa não encontrar nada no setor atual, o aplicativo procura nos demais e mostra em qual setor o equipamento está cadastrado. Ao abrir o item a partir desse aviso, o campo "Onde foi encontrado" já vem preenchido com o setor em que você está.

### 4.3 Formulário de auditoria

- **Onde foi encontrado:** vem marcado com o setor onde o equipamento deveria estar e pode ser alterado. Se for diferente da origem, um aviso azul aparece.
- **Situação da TAG:** Conforme, Pendente, Sem plaqueta ou Plaqueta rasurada. "Conforme" já vem marcado para agilizar. "Pendente" mantém o item como não auditado.
- **Conferir TAG, nº de série, patrimônio e modelo:** permite corrigir os dados encontrados no equipamento. O valor do cadastro original continua preservado nas colunas "Anterior".
- **Observação:** texto livre.

Ao salvar, o aplicativo volta para a lista do setor com o campo de pesquisa pronto para o próximo item.

A gravação segue as convenções do Effort. Se a situação for "Conforme" e o setor encontrado for diferente da origem, o motivo é gravado como *Encontrado em outro local*. O *Status* só fica "Conforme" quando o motivo é "Conforme"; nos demais casos fica "Não conforme".

Para corrigir um registro, abra o item e salve de novo, ou use **Desfazer auditoria** para devolvê-lo à situação de pendente.

### 4.4 TAGs fora do padrão

O padrão esperado é **letras seguidas de números**, com hífen opcional: `BINF1234`, `BINF-1234` e `CENT-0002` são aceitas; `174-0001`, `FLUXO2-0001` e `1234BINF` são sinalizadas.

TAGs fora do padrão são gravadas normalmente, mas aparecem com a marca "TAG fora do padrão" na lista e geram um aviso ao salvar. O link **TAGs fora do padrão**, na tela inicial, lista todas elas por setor, para planejar a troca das plaquetas.

Para mudar o padrão, edite a linha `PADRAO_TAG` em `config.py` (é uma expressão regular) e reinicie o aplicativo.

## 5. Vários auditores e consolidação

Cada auditor usa uma instalação própria. Todos importam a mesma planilha do Effort e, ao final, cada um usa **Planilhas > Exportar planilha**. O arquivo gerado (`Auditoria_de_Ativos_NOME_DATA.xlsx`) tem exatamente as mesmas colunas da planilha do Effort.

No aparelho que vai consolidar:

1. Abra **Planilhas**.
2. Selecione **todos** os arquivos de uma vez (a planilha original do Effort e as planilhas de cada auditor).
3. Escolha **Substituir** para começar do zero, ou **Juntar** para somar ao que já existe.
4. Clique em **Importar planilhas**.

### Regras para itens repetidos

| Situação | Resultado |
|---|---|
| Os dois pendentes | Mantém qualquer um |
| Um pendente e outro auditado | Fica o auditado |
| Os dois auditados e iguais | Mantém qualquer um |
| Os dois auditados e diferentes | Conflito: o usuário escolhe |

Na comparação entram Status, Modelo, TAG, Nº de série, Patrimônio, Setor Atual, Motivo e Observação. Executante e Data não entram, porque dois auditores podem ter constatado exatamente a mesma coisa. Diferenças apenas de maiúsculas ou espaços também são ignoradas.

Quando há conflitos, o aplicativo abre a tela **Conflitos**, que mostra as duas versões lado a lado e destaca os campos diferentes. Escolha **Manter versão A** (a que está na base) ou **Usar versão B** (a do arquivo importado). Enquanto houver conflitos sem decisão, a exportação pede confirmação.

### Como o aplicativo reconhece o mesmo equipamento

Equipamentos do cadastro são identificados pelas colunas *TAG Anterior*, *Número de Série Anterior*, *Patrimônio Anterior*, *Modelo Anterior* e *Setor Origem*, que não mudam durante a auditoria. Assim, mesmo que um auditor corrija a TAG, o item continua sendo reconhecido.

Itens sem cadastro (como "Novo Equipamento" e "Equipamento Antigo") são identificados por TAG, número de série, patrimônio e descrição atuais.

## 6. Cópia de segurança e reinício

Todos os dados ficam em um único arquivo: `dados/auditoria.db`. Para fazer cópia de segurança, basta exportar a planilha ou copiar esse arquivo com o aplicativo fechado.

Para começar uma nova auditoria, importe a nova planilha no modo **Substituir**, ou use **Planilhas > Apagar base** (é preciso digitar APAGAR para confirmar).

## 7. Estrutura do projeto

```
auditoria_ativos/
├── run.py                   Inicia o servidor
├── config.py                Configurações (padrão de TAG, porta, colunas, rótulos)
├── requirements.txt         Dependências
├── iniciar_windows.bat      Inicialização no Windows
├── iniciar_linux_mac.sh     Inicialização no Linux/macOS
├── COMO_USAR.md             Este documento
├── dados/                   Banco de dados (criado automaticamente)
├── tests/test_regras.py     Testes automáticos
└── app/
    ├── __init__.py          Cria o aplicativo Flask
    ├── utils.py             Normalização de texto, validação de TAG, identificação
    ├── db.py                Conexão e tabelas do SQLite
    ├── repositorio.py       Todas as consultas ao banco
    ├── planilha.py          Leitura e geração de planilhas Excel
    ├── mesclagem.py         Regras de itens repetidos e conflitos
    ├── rotas/
    │   ├── principal.py     Tela inicial, setores, pesquisa, auditor
    │   ├── auditoria.py     Formulário de auditoria e "desfazer"
    │   └── arquivos.py      Importar, exportar, apagar, conflitos
    ├── templates/           Páginas HTML (Jinja2)
    └── static/
        ├── css/estilo.css   Visual (cores nas variáveis do início do arquivo)
        └── js/app.js        Avisos em tempo real e confirmações
```

## 8. Manutenção e alterações comuns

**Mudar a porta ou restringir o acesso ao próprio computador:** em `config.py`, altere `PORTA`, ou troque `HOST` para `"127.0.0.1"`. Se mudar a porta, ajuste também o endereço no `iniciar_windows.bat`.

**Mudar as opções de situação da TAG:** edite `SITUACOES_TAG` em `config.py`. A chave é o texto gravado na planilha e o valor é o texto exibido na tela.

**Mudar cores:** edite as variáveis no início de `app/static/css/estilo.css` (`--verde`, `--ambar` etc.).

**Mudar o nome de uma coluna:** se o Effort passar a exportar uma coluna com outro título, ajuste o dicionário `COLUNAS` em `config.py`. A leitura ignora maiúsculas e acentos, e a ordem das colunas na planilha não importa.

**Modo de desenvolvimento:** `python run.py --dev` recarrega o aplicativo automaticamente sempre que um arquivo é salvo e mostra erros detalhados no navegador.

**Testes:** depois de qualquer alteração nas regras, rode `python -m unittest -v` na pasta do projeto. Os testes usam um banco temporário e não mexem nos dados reais.

**Atualizar para uma nova versão:** substitua os arquivos do projeto, mas **preserve a pasta `dados/`** (e, se quiser evitar reinstalar, a pasta `.venv/`). Se `requirements.txt` mudar, apague o arquivo `.venv/instalado.ok` para que o script reinstale as dependências.

## 9. Problemas comuns

| Sintoma | Solução |
|---|---|
| "python não é reconhecido" | Reinstale o Python marcando "Add python.exe to PATH" |
| Falha ao instalar dependências | Verifique a internet ou o proxy; apague `.venv/` e tente de novo |
| "Address already in use" / porta ocupada | O aplicativo já está aberto em outra janela, ou mude `PORTA` em `config.py` |
| Celular não abre o endereço | Libere no Firewall do Windows e confirme que está na mesma rede |
| "Colunas obrigatórias não encontradas" | A planilha precisa ter pelo menos *Equipamento* e *Setor Origem* ou *Setor Atual* na primeira linha |
| "O arquivo não parece ser uma planilha" | Aceita somente .xls e .xlsx; abra no Excel e salve como .xlsx |
