const puppeteer = require("puppeteer");
const xlsx = require("xlsx");
const path = require("path");

const startDownloads = async (ids) => {
  if (!ids.length) {
    console.log("Nenhum ID encontrado!");
    return;
  }
  const chromePath =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

  const browser = await puppeteer.launch({
    // executablePath: chromePath,
    headless: true,
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();

  for (const id of ids) {
    // for (let a = 1; a < 3; a++) {
    try {
      // const url = `https://conta.oxpay.com.br/contract/${ids[0]}/1`;
      const url = `https://web-oxpay.netlify.app/contract/${id}/1`;
      // const url = `https://localhost:3000/contract/${ids[0]}/1`;
      console.log(`Acessando: ${url}`);
      await page.goto(url, { waitUntil: "networkidle2" });

      await page.waitForSelector("#download");
      await page.click("#download");
    } catch (err) {
      console.log(err);
      break;
    }
    // }
  }

  console.log("Processo concluído.");
  // await browser.close();
};

module.exports = { startDownloads };

const idsDemo = [
  "BSZptCjvXtnIklDi9AGi3oCV8PHXydNv",
  "N8ZjvXUAswOvhOThDxzFwByfLH8OMyJp",
  "NHcmwGhtyMtHYuvj7QL1V8rdBmu3kHB6",
];
// startDownloads(idsDemo);
