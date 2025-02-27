const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const DOWNLOAD_DIR = path.join(__dirname, "downloads");
const ZIP_PATH = path.join(__dirname, "contracts.zip");

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

const startDownloads = async (ids) => {
  if (!ids.length) {
    console.log("Nenhum ID encontrado!");
    return;
  }

  const browser = await puppeteer.launch({
    headless: true, // Rodar no servidor sem UI
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      `--disable-extensions`,
    ],
  });

  const page = await browser.newPage();

  for (const id of ids) {
    try {
      const url = `https://web-oxpay.netlify.app/contract/${id}/1`;
      console.log(`Acessando: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2" });

      await page.waitForSelector("#download");
      const downloadPath = path.join(DOWNLOAD_DIR, `${id}.pdf`);

      // Intercepta as requisições de download
      page.on("response", async (response) => {
        const headers = response.headers();
        if (headers["content-disposition"]?.includes("attachment")) {
          const buffer = await response.buffer();
          fs.writeFileSync(downloadPath, buffer);
          console.log(`Download concluído: ${downloadPath}`);
        }
      });

      await page.click("#download");
      await page.waitForTimeout(5000); // Aguarda o download
    } catch (err) {
      console.error(`Erro ao processar ID ${id}:`, err);
    }
  }

  await browser.close();
  console.log("Todos os downloads concluídos.");

  // Compactar os PDFs
  await zipFiles();
};

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
    archive.directory(DOWNLOAD_DIR, false);
    archive.finalize();
  });
};

module.exports = { startDownloads, ZIP_PATH };
