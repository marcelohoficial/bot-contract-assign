const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const archiver = require("archiver");

const DOWNLOAD_DIR = path.join(__dirname, "downloads");
const ZIP_PATH = path.join(__dirname, "contracts.zip");

if (!fs.existsSync(DOWNLOAD_DIR)) {
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

const download = async (ids) => {
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

  let totalIds = ids.length;
  let successIds = 0;
  let errorIds = 0;
  let retry = [];
  let count = 0;
  let tryIds = 0;

  for (const id of ids) {
    tryIds++;
    try {
      const api = `https://api.oxpay.com.br/contract/${id}`;

      if ((await fetch(api).then((res) => res.status)) !== 200) {
        console.log(`Ignorando: ${id}`);
        continue;
      }

      // const url = `https://web-oxpay.netlify.app/contract/${id}/1`;
      const url = `http://localhost:3000/contract/${id}/1`;
      console.log(`Acessando: ${url}`);
      await page.goto(url, { waitUntil: "networkidle0" });
      await delay(5000);
      await page.waitForSelector("#download", {
        timeout: 600000,
        visible: true,
      });
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
      successIds++;
    } catch (err) {
      retry.push(id);
      console.error(`Erro ao processar ID ${id}:`, err);
      count = 30;
      errorIds++;
    }

    if (count >= 10) {
      await delay(10000);
      count = 0;
    } else count++;

    if (tryIds > totalIds * 3) break;
  }

  if (retry.length) {
    count = 0;
    for (const id of retry) {
      tryIds++;
      try {
        const api = `https://api.oxpay.com.br/contract/${id}`;

        if ((await fetch(api).then((res) => res.status)) !== 200) {
          console.log(`Ignorando: ${id}`);
          retry.slice(1);
          continue;
        }

        // const url = `https://web-oxpay.netlify.app/contract/${id}/1`;
        const url = `http://localhost:3000/contract/${id}/1`;
        console.log(`Acessando: ${url}`);
        await page.goto(url, { waitUntil: "networkidle0" });
        await delay(5000);
        await page.waitForSelector("#download", {
          timeout: 600000,
          visible: true,
        });
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

        retry.slice(1);
        successIds++;
        errorIds--;
      } catch (err) {
        console.error(`Erro ao processar ID ${id}:`, err);
      }

      if (count >= 10) {
        await delay(10000);
        count = 0;
      } else count++;

      if (tryIds > totalIds * 3) break;
    }
  }

  if (retry.length)
    fs.writeFileSync(__dirname + "retry", JSON.stringify(retry));

  await browser.close();
  console.log(`
    ---------------Dashboard---------------
    Total Ids: ${totalIds}
    Sucessos: ${successIds}
    Erros: ${errorIds}
    Tentativas: ${tryIds}
    Tentativas falhas: ${retry.length}
  `);

  // Compactar os PDFs
  if (successIds.length) await zipFiles();
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
    archive.directory(DOWNLOAD_DIR, false);
    archive.finalize();
  });
};

module.exports = { download, ZIP_PATH };
