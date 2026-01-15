import puppeteer from "puppeteer";
import fs from "fs";

const providedArgs = process.argv.slice(2);

if (providedArgs.length !== 1) {
  throw new Error("The script takes 2 parameters as input");
}

let url = providedArgs[0];

if (!url.startsWith("https://")) {
  url = "https://" + url;
}

const getUrl = new URL(url);
const categoryId = getUrl["pathname"].split("/")[2];

const browser = await puppeteer.launch({
  headless: false,
  args: [`--window-size=1920,1080`],
  defaultViewport: {
    width: 1920,
    height: 1080,
  },
});
const page = await browser.newPage();
await page.goto(url);
await page.waitForNavigation({ waitUntil: "domcontentloaded" });

await page.setRequestInterception(true);

page.on("request", (interceptedRequest) => {
  const postData = { noRedirect: true, url: getUrl["pathname"] };
  var data = {
    method: "POST",
    postData: JSON.stringify(postData),
  };

  interceptedRequest.continue(data);
});

const response = await page.goto(
  `https://www.vprok.ru/web/api/v1/catalog/category/${categoryId}?sort=popularity_desc&limit=30&page=1`,
);

const respBody = await response.json();
const products = respBody["products"];

for (const product of products) {
  let charArray = product["oldPrice"].toString().split("");
  let newArray = charArray.map((char) => "\u0336" + char + "\u0336");
  let strikethroughOldPrice = newArray.join("");

  let fileString = `Название товара: ${product["name"]}
    Ссылка на страницу товара: https://www.vprok.ru${product["url"]}
    Рейтинг: ${product["rating"]}
    Количество отзывов: ${product["reviews"]}
    Цена: ${product["price"]}
    Акционная цена: ${product["oldPrice"] === 0 ? "Нет" : product["price"]}
    Цена до акции: ${product["oldPrice"] === 0 ? "Нет" : strikethroughOldPrice}
    Размер скидки: ${product["discount"] === 0 ? "Нет" : product["discount"]}
    
    
    `;

  fs.writeFile("files/products-api.txt", fileString, { flag: "a" }, (err) => {
    if (err) {
      console.error("Ошибка записи файла:", err);
      return;
    }
  });
}
await browser.close();
