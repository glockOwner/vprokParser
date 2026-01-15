import puppeteer from "puppeteer";
import fs from "fs";

const providedArgs = process.argv.slice(2);

let url = providedArgs[0];
const region = providedArgs[1];
const availableRegions = [
  "Москва и область",
  "Санкт-Петербург и область",
  "Владимирская обл.",
  "Калужская обл.",
  "Рязанская обл.",
  "Тверская обл.",
  "Тульская обл.",
];

if (providedArgs.length !== 2) {
  throw new Error("The script takes 2 parameters as input");
}
if (!availableRegions.includes(region)) {
  throw new Error(
    "Region is not available. Available regions are " +
      availableRegions.join(", "),
  );
}

if (!url.startsWith("https://")) {
  url = "https://" + url;
}

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
await page.waitForSelector("next-route-announcer");
await page.waitForNavigation({ waitUntil: "domcontentloaded" });

const selectedRegion = await page.waitForSelector("span.Region_text__Wm7FO", {
  timeout: 30000,
});
const selectedRegionText = await selectedRegion.evaluate(
  (el) => el.textContent,
);

if (selectedRegionText !== region) {
  //Прокликивание нужного региона
  page.waitForSelector("button.Region_region__6OUBn");
  page.click("button.Region_region__6OUBn");
  let pageRegions = [];
  do {
    await page.waitForSelector("div.UiRegionListBase_listWrapper__Iqbd5", {
      timeout: 60000,
    });
    pageRegions = await page.$$(
      "div.UiRegionListBase_listWrapper__Iqbd5 > ul > li > button",
      { timeout: 60000 },
    );
  } while (pageRegions.length === 0);
  for (const pageRegion of pageRegions) {
    const textContent = await pageRegion.evaluate((el) => el.textContent);
    if (textContent === region) {
      await pageRegion.click();
      await page.waitForNavigation({ waitUntil: "domcontentloaded" });
      break;
    }
  }
}

let productInfo = await page.evaluate(() => {
  let productPrice = {};
  let re = /[0-9\s/.,]+/;
  if (!document.querySelector("div.PriceInfo_root__GX9Xp")) {
    productPrice["priceOld"] = null;
    productPrice["price"] = null;
  } else {
    let isOldPriceSet = document.querySelector(
      "div.PriceInfo_root__GX9Xp > div.PriceInfo_oldPrice__IW3mC",
    );
    productPrice["priceOld"] = isOldPriceSet
      ? document
          .querySelector(
            "div.PriceInfo_root__GX9Xp > div.PriceInfo_oldPrice__IW3mC > span",
          )
          .textContent.match(re)[0]
      : null;
    productPrice["price"] = document
      .querySelector("div.PriceInfo_root__GX9Xp > span")
      .textContent.match(re)[0];
  }
  let rating = document.querySelector("a.ActionsRow_stars__EKt42").textContent;
  let reviewCount = document
    .querySelector("a.ActionsRow_reviews__AfSj_")
    .textContent.match(re)[0];

  return {
    price: productPrice["price"],
    priceOld: productPrice["priceOld"],
    rating: rating,
    reviewCount: reviewCount,
  };
});

let fileString = `price=${productInfo["price"]}
priceOld=${productInfo["priceOld"]}
rating=${productInfo["rating"]}
reviewCount=${productInfo["reviewCount"]}
`;

fs.writeFile("files/product.txt", fileString, (err) => {
  if (err) {
    console.error("Ошибка записи файла:", err);
    return;
  }
  console.log("Объект успешно записан в product.txt");
});

await page.screenshot({
  path: "files/screenshot.jpg",
});

await browser.close();
