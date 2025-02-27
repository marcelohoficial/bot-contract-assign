const puppeteer = require("puppeteer");
const xlsx = require("xlsx");
const path = require("path");

async function start(ids) {
  // Iniciar o navegador Puppeteer
  const chromePath =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

  const browser = await puppeteer.launch({
    // executablePath: chromePath,
    headless: false,
    args: ["--start-maximized"],
  });

  // const browser = await puppeteer.launch({ headless: false }); // headless: true para rodar em segundo plano
  const page = await browser.newPage();

  // for (const id of ids) {
  // for (let a = 1; a < 2; a++) {
  // const url = `https://conta.oxpay.com.br/contract/${ids[0]}/1`;
  const url = `http://localhost:3000/contract/${ids[0]}/1`;
  console.log(`Acessando: ${url}`);
  await page.goto(url, { waitUntil: "networkidle2" });

  // Adicionar um pequeno delay entre as requisições
  // await page.waitForTimeout(20000);
  // await page.evaluate(() => setTimeout(() => console.log("Tempo"), [5000]));
  // await page
  // 	.waitForSelector(
  // 		"/html/body/pdf-viewer//viewer-toolbar//div/div[3]/viewer-download-controls//cr-icon-button"
  // 	)
  // 	.then((e) => console.log("First: ", e));
  // }
  // }
  // page.mouse.move(200, 500);
  await page.waitForSelector("#download");
  await page.click("#download");

  // await page.keyboard.type("Hello");

  console.log("Processo concluído.");
  // await browser.close();
}

const idsDemo = [
  "BSZptCjvXtnIklDi9AGi3oCV8PHXydNv",
  "N8ZjvXUAswOvhOThDxzFwByfLH8OMyJp",
  "NHcmwGhtyMtHYuvj7QL1V8rdBmu3kHB6",
];
start(idsDemo);
