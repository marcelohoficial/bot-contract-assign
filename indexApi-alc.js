const xlsx = require("xlsx");
const path = require("path");
const { startDownloads } = require("./src/start");
const { download } = require("./main");
const { getApi } = require("./src/api");

// Caminho do arquivo Excel
const filePath = path.join(__dirname + "/upload", "alc-ativos.xlsx");

// Ler o arquivo
const workbook = xlsx.readFile(filePath);

// Selecionar a primeira planilha
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Converter a planilha em JSON
const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });

// Pegar todos os IDs da primeira coluna (ignorando o cabeçalho)
const ids = data
  .slice(1)
  .map((row) => row[0])
  .filter((id) => id !== undefined && id.length === 32);

console.log("Total de IDs:", ids.length);
getApi(ids);
