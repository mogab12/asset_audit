// Configurações do aplicativo (port de config.py). Tudo que costuma mudar
// (padrão de TAG, nomes de colunas) fica aqui.

export const PADRAO_TAG = /^[A-Z][A-Z0-9]*-?[0-9]+$/;

export const MOTIVO_PENDENTE = "Pendente";
export const MOTIVO_CONFORME = "Conforme";
export const MOTIVO_OUTRO_LOCAL = "Encontrado em outro local";
export const MOTIVO_SEM_PLAQUETA = "Sem Plaqueta";

export const SITUACOES_TAG = {
  "Conforme": "Conforme",
  "Pendente": "Pendente",
  "Sem Plaqueta": "Sem plaqueta",
  "Plaqueta Razurada": "Plaqueta rasurada",
};

export const OUTROS_MOTIVOS = {
  "Novo Equipamento": "Novo equipamento",
  "Equipamento Antigo": "Equipamento antigo",
};

export const STATUS_CONFORME = "Conforme";
export const STATUS_NAO_CONFORME = "Não conforme";

export const COLUNAS = {
  status: "Status",
  modelo_anterior: "Modelo Anterior",
  modelo: "Modelo",
  tag_anterior: "TAG Anterior",
  tag: "TAG",
  ns_anterior: "Número de Série Anterior",
  ns: "Número de Série",
  patrimonio_anterior: "Patrimônio Anterior",
  patrimonio: "Patrimônio",
  setor_origem: "Setor Origem",
  setor_atual: "Setor Atual",
  equipamento: "Equipamento",
  motivo: "Motivo não Conformidade",
  observacao: "Observação",
  executante: "Executante",
  data: "Data",
};
export const NOME_ABA_EXPORTACAO = "Auditoria";

export const CAMPOS_COMPARACAO = [
  "status", "modelo", "tag", "ns", "patrimonio",
  "setor_atual", "motivo", "observacao",
];

export const COLUNAS_REFERENCIA_EFFORT = {
  id_effort: "ID",
  tag: "TAG",
  ns: "Nº de Série",
  patrimonio: "Patrimônio",
  equipamento: "Equipamento",
  modelo: "Modelo",
  setor: "Setor",
};

// O QR code do Effort traz uma URL como
// https://huusp.globalthings.net/Mobile/MEquipamentoPropriedade.aspx?eqp=16933
// — o que interessa é o número depois de "eqp=".
export const PADRAO_URL_EFFORT = /eqp=(\d+)/;

export const ARQUIVO_EQUIPAMENTOS_PADRAO = "dados/Equipamentos.xlsx";

// Planilha de auditoria de exemplo, importada automaticamente na primeira
// abertura do app (só se ainda não houver nenhum equipamento na base).
export const ARQUIVO_AUDITORIA_PADRAO = "dados/Auditoria.xlsx";
