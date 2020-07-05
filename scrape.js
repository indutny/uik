'use strict';

const puppeteer = require('puppeteer');
const read = require('read');
const debug = require('debug')('uik');
const { spawnSync } = require('child_process');
const fs = require('fs');

const REGIONS = [
  {
    "name": "Адыгея (республика)",
    "region": "100100163596970"
  },
  {
    "name": "Алтай (республика)",
    "region": "100100163596971"
  },
  {
    "name": "Алтайский край",
    "region": "100100163598031"
  },
  {
    "name": "Амурская область",
    "region": "100100163598037"
  },
  {
    "name": "Архангельская область",
    "region": "100100163598038"
  },
  {
    "name": "Астраханская область",
    "region": "100100163598039"
  },
  {
    "name": "Башкортостан (республика)",
    "region": "100100163598012"
  },
  {
    "name": "Белгородская область",
    "region": "100100163598040"
  },
  {
    "name": "Брянская область",
    "region": "100100163598041"
  },
  {
    "name": "Бурятия (республика)",
    "region": "100100163598013"
  },
  {
    "name": "Владимирская область",
    "region": "100100163598042"
  },
  {
    "name": "Волгоградская область",
    "region": "100100163598043"
  },
  {
    "name": "Вологодская область",
    "region": "100100163598044"
  },
  {
    "name": "Воронежская область",
    "region": "100100163598045"
  },
  {
    "name": "Дагестан (республика)",
    "region": "100100163598014"
  },
  {
    "name": "Еврейская автономная область",
    "region": "100100163598085"
  },
  {
    "name": "Забайкальский край",
    "region": "100100163598092"
  },
  {
    "name": "Ивановская область",
    "region": "100100163598046"
  },
  {
    "name": "Ингушетия (республика)",
    "region": "100100163598015"
  },
  {
    "name": "Иркутская область",
    "region": "100100163598047"
  },
  {
    "name": "Кабардино-Балкария (республика)",
    "region": "100100163598016"
  },
  {
    "name": "Калининградская область",
    "region": "100100163598048"
  },
  {
    "name": "Калмыкия (республика)",
    "region": "100100163598017"
  },
  {
    "name": "Калужская область",
    "region": "100100163598049"
  },
  {
    "name": "Камчатский край",
    "region": "100100163598091"
  },
  {
    "name": "Карачаево-Черкесия (республика)",
    "region": "100100163598018"
  },
  {
    "name": "Карелия (республика)",
    "region": "100100163598019"
  },
  {
    "name": "Кемеровская область",
    "region": "100100163598050"
  },
  {
    "name": "Кировская область",
    "region": "100100163598051"
  },
  {
    "name": "Коми (республика)",
    "region": "100100163598020"
  },
  {
    "name": "Костромская область",
    "region": "100100163598052"
  },
  {
    "name": "Краснодарский край",
    "region": "100100163598032"
  },
  {
    "name": "Красноярский край",
    "region": "100100163598033"
  },
  {
    "name": "Крым (республика)",
    "region": "100100163598093"
  },
  {
    "name": "Курганская область",
    "region": "100100163598053"
  },
  {
    "name": "Курская область",
    "region": "100100163598054"
  },
  {
    "name": "Ленинградская область",
    "region": "100100163598055"
  },
  {
    "name": "Липецкая область",
    "region": "100100163598056"
  },
  {
    "name": "Магаданская область",
    "region": "100100163598057"
  },
  {
    "name": "Марий Эл (республика)",
    "region": "100100163598021"
  },
  {
    "name": "Мордовия (республика)",
    "region": "100100163598022"
  },
  {
    "name": "Москва",
    "region": "100100163598083"
  },
  {
    "name": "Московская область",
    "region": "100100163598058"
  },
  {
    "name": "Мурманская область",
    "region": "100100163598059"
  },
  {
    "name": "Ненецкий автономный округ",
    "region": "100100163598086"
  },
  {
    "name": "Нижегородская область",
    "region": "100100163598060"
  },
  {
    "name": "Новгородская область",
    "region": "100100163598061"
  },
  {
    "name": "Новосибирская область",
    "region": "100100163598062"
  },
  {
    "name": "Омская область",
    "region": "100100163598063"
  },
  {
    "name": "Оренбургская область",
    "region": "100100163598064"
  },
  {
    "name": "Орловская область",
    "region": "100100163598065"
  },
  {
    "name": "Пензенская область",
    "region": "100100163598066"
  },
  {
    "name": "Пермский край",
    "region": "100100163598090"
  },
  {
    "name": "Приморский край",
    "region": "100100163598034"
  },
  {
    "name": "Псковская область",
    "region": "100100163598067"
  },
  {
    "name": "Ростовская область",
    "region": "100100163598068"
  },
  {
    "name": "Рязанская область",
    "region": "100100163598069"
  },
  {
    "name": "Самарская область",
    "region": "100100163598070"
  },
  {
    "name": "Санкт-Петербург",
    "region": "100100163598084"
  },
  {
    "name": "Саратовская область",
    "region": "100100163598071"
  },
  {
    "name": "Саха (республика)",
    "region": "100100163598023"
  },
  {
    "name": "Сахалинская область",
    "region": "100100163598072"
  },
  {
    "name": "Свердловская область",
    "region": "100100163598073"
  },
  {
    "name": "Севастополь",
    "region": "100100163598094"
  },
  {
    "name": "Северная Осетия (республика)",
    "region": "100100163598024"
  },
  {
    "name": "Смоленская область",
    "region": "100100163598074"
  },
  {
    "name": "Ставропольский край",
    "region": "100100163598035"
  },
  {
    "name": "Тамбовская область",
    "region": "100100163598075"
  },
  {
    "name": "Татарстан (республика)",
    "region": "100100163598025"
  },
  {
    "name": "Тверская область",
    "region": "100100163598076"
  },
  {
    "name": "Томская область",
    "region": "100100163598077"
  },
  {
    "name": "Тульская область",
    "region": "100100163598078"
  },
  {
    "name": "Тыва (республика)",
    "region": "100100163598026"
  },
  {
    "name": "Тюменская область",
    "region": "100100163598079"
  },
  {
    "name": "Удмуртия (республика)",
    "region": "100100163598027"
  },
  {
    "name": "Ульяновская область",
    "region": "100100163598080"
  },
  {
    "name": "Хабаровский край",
    "region": "100100163598036"
  },
  {
    "name": "Хакасия (республика)",
    "region": "100100163598028"
  },
  {
    "name": "Ханты-Мансийский автономный округ",
    "region": "100100163598087"
  },
  {
    "name": "Челябинская область",
    "region": "100100163598081"
  },
  {
    "name": "Чечня (республика)",
    "region": "100100163598029"
  },
  {
    "name": "Чувашия (республика)",
    "region": "100100163598030"
  },
  {
    "name": "Чукотский автономный округ",
    "region": "100100163598088"
  },
  {
    "name": "Ямало-Ненецкий автономный округ",
    "region": "100100163598089"
  },
  {
    "name": "Ярославская область",
    "region": "100100163598082"
  }
];

function getRegionRoot(region) {
  return 'http://www.vybory.izbirkom.ru/region/amur?' +
    `action=show&vrn=100100163596966&tvd=${region}`;
}

function getSubregionResults(subregion) {
  return 'http://www.vybory.izbirkom.ru/region/amur' +
    `?action=show&vrn=100100163596966&tvd=${subregion}&type=465`;
}

async function goto(page, uri) {
  for (;;) {
    try {
      await page.goto(uri);
      break;
    } catch (err) {
      debug('failed to load page, retrying', err.stack);
    }
  }

  for (;;) {
    const captcha = await page.$('#captchaImg');
    if (!captcha) {
      break;
    }

    debug('captcha required');
    await new Promise((resolve, reject) => {
      read({
        prompt: 'Awaiting solved captcha',
      }, (err) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });

    const send = await page.$('#send');
    if (!send) {
      debug('Can\'t solve captcha without send button');
      return await goto(page, uri);
    }

    await send.click();

    try {
      await page.waitForNavigation();
    } catch (err) {
      debug('failed to load page, retrying', err.stack);
      return await goto(page, uri);
    }
  }
}

async function loadSubregion(page, stream, options) {
  const { subregion, subregionName } = options;
  debug(`loading subregion's results: ${subregionName}/${subregion}`);

  await goto(page, getSubregionResults(subregion));

  const rowSelector = 'table table div > table tr';
  const stats = await page.$$eval(rowSelector, (rows) => {
    const names = Array.from(rows[0].children).map((elem) => elem.textContent);

    const registered = Array.from(rows[1].children)
      .map((elem) => parseInt(elem.textContent, 10));
    const came = Array.from(rows[2].children)
      .map((elem) => parseInt(elem.textContent, 10));
    const voted = Array.from(rows[3].children)
      .map((elem) => parseInt(elem.textContent, 10));
    const invalid = Array.from(rows[4].children)
      .map((elem) => parseInt(elem.textContent, 10));

    const yes = Array.from(rows[6].children)
      .map((elem) => parseInt(elem.querySelector('b').textContent, 10));
    const no = Array.from(rows[7].children)
      .map((elem) => parseInt(elem.querySelector('b').textContent, 10));

    const out = [];
    for (const [ i, name ] of names.entries()) {
      out.push({
        name,
        registered: registered[i],
        came: came[i],
        voted: voted[i],
        invalid: invalid[i],

        yes: yes[i],
        no: no[i],
      });
    }
    return out;
  });

  for (const line of stats) {
    const columns = [
      options.regionName,
      options.region,
      options.subregionName,
      options.subregion,

      line.name,
      line.registered,
      line.came,
      line.voted,
      line.invalid,
      line.yes,
      line.no,
    ];

    const csv = columns.map((column) => {
      if (typeof column === 'string') {
        return JSON.stringify(column);
      } else {
        return column.toString();
      }
    });

    stream.write(csv.join(', ') + '\n');
  }
}

async function main() {
  const stream = fs.createWriteStream('data.csv');

  const browser = await puppeteer.launch({
    headless: false,
  });

  const page = await browser.newPage();
  stream.write('region name, region id, subregion name, subregion id, ' +
    'station name, registered, came, voted, invalid, yes, no\n');

  for (const { name: regionName, region } of REGIONS) {
    debug(`loading region's root page: ${regionName}/${region}`);
    await goto(page, getRegionRoot(region));

    const options = await page.$$eval(
      'form[name="go_reg"] option',
      (elems) => {
        return elems.map((elem) => {
          return { name: elem.textContent, value: elem.value };
        });
      });

    const subregions = options.map((option) => {
      const match = option.value.match(/&tvd=(\d+)/);
      if (!match) {
        return false;
      }

      return { name: option.name, subregion: match[1] };
    }).filter((x) => x);

    for (const { name: subregionName, subregion } of subregions) {
      await loadSubregion(page, stream, {
        regionName,
        region,
        subregionName,
        subregion,
      });
    }
  }

  debug('done');
  stream.close();
}

main().catch((e) => {
  console.error(e.stack);
  process.exit(1);
});
