# Auditoria de Ativos: app Android nativo (.apk)

Empacota a PWA de `mobile/` dentro de um aplicativo Android de verdade, usando
[Capacitor](https://capacitorjs.com/). Diferente da PWA instalada pelo Chrome,
aqui:

- A câmera funciona ao vivo de verdade: o WebView do Capacitor carrega o app
  por `https://localhost` (um "contexto seguro"), o que o navegador exige para
  liberar `getUserMedia`. Pela rede local em HTTP simples isso é bloqueado —
  foi exatamente esse o problema da versão PWA pura.
- Não depende de nenhum servidor, rede Wi-Fi ou internet, nem uma vez: todos os
  arquivos do `mobile/` ficam empacotados dentro do próprio `.apk`. O
  aplicativo não tem nem a permissão de internet (só a de câmera).
- Continua sendo o mesmo código de `mobile/` (mesma lógica, mesmo visual). Ele
  é copiado para dentro do projeto Android a cada build — não é preciso
  reescrever nada quando `mobile/` mudar (veja a seção 4).

## 1. Instalar o `.apk` já pronto

O `.apk` de depuração fica em:

```
android-app/android/app/build/outputs/apk/debug/app-debug.apk
```

Duas formas de colocá-lo no celular:

**Por cabo USB (não usa rede nenhuma):**
1. Ative "Depuração USB" no celular (Ajustes > Opções do desenvolvedor).
2. Com o celular conectado: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`

**Copiando o arquivo:** transfira o `.apk` para o celular (cabo, cartão SD
etc.) e abra-o pelo gerenciador de arquivos. Na primeira vez, o Android pede
para permitir "instalar app de fontes desconhecidas" — autorize só para o
gerenciador de arquivos usado.

Ao abrir o app, na primeira leitura de QR code o Android vai pedir a
permissão de câmera; toque em Permitir.

## 2. Recompilar do zero

Precisa de: Java (JDK 17+), Node.js 22+ e o Android SDK (cmdline-tools,
platform-tools, platform android-34, build-tools 34.0.0 — instalados nesta
máquina em `~/Android/Sdk`).

```bash
cd android-app
npm install                 # só na primeira vez
npx cap sync android        # copia mobile/ para dentro do projeto Android
cd android
./gradlew assembleDebug
```

O `.apk` novo aparece no mesmo caminho da seção 1.

## 3. Atualizar depois de mexer em `mobile/`

Sempre que editar algo em `mobile/` (telas, regras, ícones...), antes de gerar
um novo `.apk` rode, dentro de `android-app/`:

```bash
npx cap sync android
cd android && ./gradlew assembleDebug
```

O `npx cap sync` copia o conteúdo atual de `mobile/` para
`android/app/src/main/assets/public` (essa pasta é gerada automaticamente, não
edite os arquivos ali diretamente).

## 4. Estrutura

```
android-app/
├── capacitor.config.json   appId, nome do app e onde estão os arquivos web (../mobile)
├── package.json            dependências do Capacitor (@capacitor/core, /cli, /android)
└── android/                projeto Android nativo, gerado pelo Capacitor
    ├── app/src/main/AndroidManifest.xml   permissão de câmera (só essa)
    ├── app/src/main/java/.../MainActivity.java   ativado sem alterações — o
    │                                              próprio Capacitor já trata o
    │                                              pedido de permissão de câmera
    │                                              do getUserMedia
    ├── app/src/main/res/mipmap-*/         ícone do app (mesma marca da PWA)
    └── app/build/outputs/apk/debug/app-debug.apk  o instalável
```

## 5. Assinar para o Play Store ou distribuir "release" (opcional)

O `.apk` gerado é um build de **depuração** (não precisa de assinatura para
instalar diretamente no celular). Para gerar um `.apk`/`.aab` de release
assinado (necessário só se for publicar na Play Store), seria preciso criar um
keystore próprio e configurar a assinatura em `android/app/build.gradle` — não
foi feito aqui porque não é necessário para uso interno/pessoal.

## 6. App id e nome

- App ID: `com.auditoria.ativos`
- Nome exibido: "Auditoria de Ativos"

Para mudar qualquer um dos dois, edite `capacitor.config.json` e rode
`npx cap sync android` de novo.
