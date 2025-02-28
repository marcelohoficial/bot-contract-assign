const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");
const { default: axios } = require("axios");

const DOWNLOAD_DIR = path.join(__dirname, "downloads");
const ZIP_PATH = path.join(__dirname, "contracts.zip");
const DATA_DIR = path.join(__dirname, "data");
const ERROR_LOG_PATH = path.join(__dirname, "error_ids.json");

// Criar diretórios necessários
if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const saveDataBatch = (data, batchNumber) => {
  const fileName = path.join(DATA_DIR, `data_batch_${batchNumber}.json`);
  fs.writeFileSync(fileName, JSON.stringify(data, null, 2));
  console.log(`Dados salvos no arquivo: ${fileName}`);
};

const saveErrorIds = (errorIds) => {
  fs.writeFileSync(ERROR_LOG_PATH, JSON.stringify(errorIds, null, 2));
  console.log(`IDs com erro salvos em: ${ERROR_LOG_PATH}`);
};

const getApi = async (ids) => {
  if (!ids.length) {
    console.log("Nenhum ID encontrado!");
    return;
  }

  let totalIds = ids.length;
  let successIds = 0;
  let errorIds = 0;
  let errorList = [];
  let successData = [];
  let batchNumber = 1;
  let count = 0;
  let tryIds = 0;

  // Variáveis para controle de pausa periódica
  const REQUESTS_BEFORE_LONG_PAUSE = 100;
  const LONG_PAUSE_DURATION = 60000; // 1 minuto
  const REGULAR_PAUSE_DURATION = 3000; // 3 segundos entre chamadas
  const RETRY_PAUSE_DURATION = 10000; // 10 segundos após erro

  console.log(`Iniciando processamento de ${totalIds} IDs...`);

  for (const id of ids) {
    tryIds++;

    try {
      // Pausa longa periódica a cada N requisições
      if (tryIds % REQUESTS_BEFORE_LONG_PAUSE === 0) {
        console.log(
          `Realizando pausa preventiva de ${
            LONG_PAUSE_DURATION / 1000
          } segundos após ${REQUESTS_BEFORE_LONG_PAUSE} requisições...`
        );
        await delay(LONG_PAUSE_DURATION);
      }

      const api = `https://api.oxpay.com.br/contract/${id}`;

      console.log(`Processando ID: ${id} (${tryIds}/${totalIds})`);

      const { data } = await axios({
        method: "GET",
        url: api,
      });

      // Armazenar dados de sucesso
      successData.push({
        id,
        data,
        timestamp: new Date().toISOString(),
      });

      successIds++;

      // Salvar em lotes de 50
      if (successData.length >= 50) {
        saveDataBatch(successData, batchNumber);
        batchNumber++;
        successData = []; // Limpar após salvar
      }

      // Pausa regular entre requisições
      await delay(REGULAR_PAUSE_DURATION);
    } catch (err) {
      const errorInfo = {
        id,
        status: err?.response?.status || "unknown",
        message: err?.message || "Unknown error",
        timestamp: new Date().toISOString(),
      };

      errorList.push(errorInfo);
      console.error(`Erro ID: ${id}:`, errorInfo.status);

      // Pausa maior após erro para evitar bloqueio
      await delay(RETRY_PAUSE_DURATION);

      errorIds++;
    }

    // Se tentou muitas vezes, interromper
    if (tryIds > totalIds * 3) {
      console.log("Limite de tentativas atingido. Finalizando...");
      break;
    }
  }

  // Salvar último lote de dados (se houver)
  if (successData.length > 0) {
    saveDataBatch(successData, batchNumber);
  }

  // Salvar lista de erros
  if (errorList.length > 0) {
    saveErrorIds(errorList);
  }

  console.log(`
    ---------------Dashboard---------------
    Total Ids: ${totalIds}
    Sucessos: ${successIds}
    Erros: ${errorIds}
    Tentativas: ${tryIds}
    IDs com erro: ${errorList.length}
  `);

  // Compactar os PDFs se houver sucessos
  if (successIds > 0) {
    console.log("Compactando arquivos...");
    await zipFiles();
  }

  return {
    totalIds,
    successIds,
    errorIds,
    errorList,
  };
};

function delay(time) {
  return new Promise(function (resolve) {
    setTimeout(resolve, time);
  });
}

const zipFiles = async () => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(ZIP_PATH);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(
        `Arquivo ZIP criado: ${ZIP_PATH} (${archive.pointer()} bytes)`
      );
      resolve();
    });

    archive.on("error", (err) => reject(err));
    archive.pipe(output);

    // Incluir tanto arquivos de download quanto dados JSON
    archive.directory(DOWNLOAD_DIR, "downloads");
    archive.directory(DATA_DIR, "data");

    archive.finalize();
  });
};

module.exports = { getApi, ZIP_PATH };
