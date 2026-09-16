// Banco de dados local (IndexedDB, um banco por celular).
// Port de app/db.py: mesmas "tabelas", agora como object stores.

const NOME_BANCO = "auditoria-ativos";
const VERSAO = 1;

let _promessaBanco = null;

function abrir() {
  if (_promessaBanco) return _promessaBanco;
  _promessaBanco = new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_BANCO, VERSAO);
    pedido.onupgradeneeded = () => {
      const banco = pedido.result;
      if (!banco.objectStoreNames.contains("equipamentos")) {
        banco.createObjectStore("equipamentos", { keyPath: "id", autoIncrement: true });
      }
      if (!banco.objectStoreNames.contains("referencia_effort")) {
        banco.createObjectStore("referencia_effort", { keyPath: "id_effort" });
      }
      if (!banco.objectStoreNames.contains("conflitos")) {
        banco.createObjectStore("conflitos", { keyPath: "id", autoIncrement: true });
      }
      if (!banco.objectStoreNames.contains("preferencias")) {
        banco.createObjectStore("preferencias", { keyPath: "nome" });
      }
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
  return _promessaBanco;
}

function comStore(nome, modo, fn) {
  return abrir().then((banco) => new Promise((resolve, reject) => {
    const transacao = banco.transaction(nome, modo);
    const store = transacao.objectStore(nome);
    const resultado = fn(store);
    transacao.oncomplete = () => resolve(resultado);
    transacao.onerror = () => reject(transacao.error);
    transacao.onabort = () => reject(transacao.error);
  }));
}

function pedidoParaPromessa(pedido) {
  return new Promise((resolve, reject) => {
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

export function getAll(nomeStore) {
  return abrir().then((banco) => new Promise((resolve, reject) => {
    const pedido = banco.transaction(nomeStore, "readonly").objectStore(nomeStore).getAll();
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  }));
}

export function get(nomeStore, chave) {
  return abrir().then((banco) => new Promise((resolve, reject) => {
    const pedido = banco.transaction(nomeStore, "readonly").objectStore(nomeStore).get(chave);
    pedido.onsuccess = () => resolve(pedido.result ?? null);
    pedido.onerror = () => reject(pedido.error);
  }));
}

// Grava e devolve a chave gravada (útil para pegar o id gerado em inserções).
export function put(nomeStore, valor) {
  return comStore(nomeStore, "readwrite", (store) => pedidoParaPromessa(store.put(valor)));
}

export function putVarios(nomeStore, valores) {
  return comStore(nomeStore, "readwrite", (store) => {
    valores.forEach((v) => store.put(v));
  });
}

export function del(nomeStore, chave) {
  return comStore(nomeStore, "readwrite", (store) => {
    store.delete(chave);
  });
}

export function clear(nomeStore) {
  return comStore(nomeStore, "readwrite", (store) => {
    store.clear();
  });
}
