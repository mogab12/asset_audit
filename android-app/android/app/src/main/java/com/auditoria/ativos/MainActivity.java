package com.auditoria.ativos;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

// Por padrão a WebView do Capacitor ignora o tamanho de fonte que o usuário
// configurou em Ajustes > Vídeo e texto > Tamanho da fonte do Android: o app
// sempre renderiza o CSS em 100%, mesmo que a pessoa tenha aumentado a fonte
// do sistema (comum entre usuários mais velhos). Replicamos aqui esse ajuste
// via textZoom, limitado a 130% para não quebrar layouts mais apertados
// (leitor de QR, grades de campos) em tamanhos extremos ("enorme").
public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    float fontScale = getResources().getConfiguration().fontScale;
    int textZoom = Math.round(Math.min(Math.max(fontScale, 1f), 1.3f) * 100);
    getBridge().getWebView().getSettings().setTextZoom(textZoom);
  }
}
