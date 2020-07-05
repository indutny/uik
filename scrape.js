'use strict';

const puppeteer = require('puppeteer');
const read = require('read');
const debug = require('debug')('uik');
const { spawnSync } = require('child_process');
const fs = require('fs');

const POOL_SIZE = 8;

const ROOT_URI = 'http://www.vybory.izbirkom.ru/region/region/izbirkom?' +
  'action=show&root=1&tvd=100100163596969&vrn=100100163596966';

const EXCEPTION_REGIONS = [
  '100100164050019', // "98 Город Байконур (Республика Казахстан)"
  '100100164050020', // "99 Территория за пределами РФ"
];

class Pool {
  constructor(browser, size) {
    this.browser = browser;
    this.size = size;

    this.pages = [];
    this.queue = [];
  }

  async start() {
    for (let i = 0; i < this.size; i++) {
      const page = await this.browser.newPage();
      this.pages.push(page);
    }
  }

  async get() {
    if (this.pages.length) {
      return this.pages.shift();
    }

    return await new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(page) {
    if (this.queue.length === 0) {
      this.pages.push(page);
      return;
    }

    this.queue.shift()(page);
  }
}

function getRegionRoot(region) {
  return 'http://www.vybory.izbirkom.ru/region/amur?' +
    `action=show&vrn=100100163596966&tvd=${region}`;
}

function getSubregionResults(subregion) {
  return 'http://www.vybory.izbirkom.ru/region/amur' +
    `?action=show&vrn=100100163596966&tvd=${subregion}&type=465`;
}

function getStationResults(subregion, station) {
  return 'http://www.vybory.izbirkom.ru/region/amur' +
    `?action=show&vrn=100100163596966&tvd=${subregion}&vibid=${station}&` +
    `type=465`;
}

async function goto(page, uri) {
  for (;;) {
    try {
      await page.goto(uri, {
        waitUntil: 'domcontentloaded',
        timeout: 15000,
      });
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
    rows = rows.filter((row) => row.children.length !== 0);
    if (rows.length < 8) {
      return [];
    }

    const names = Array.from(rows[0].children).map((elem) => elem.textContent);
    const ids = Array.from(rows[0].children).map((elem) => {
      return elem.querySelector('a').href.match(/&vibid=(\d+)/)[1];
    });

    const registered = Array.from(rows[1].children)
      .map((elem) => parseInt(elem.textContent, 10));
    const attended = Array.from(rows[2].children)
      .map((elem) => parseInt(elem.textContent, 10));
    const voted = Array.from(rows[3].children)
      .map((elem) => parseInt(elem.textContent, 10));
    const invalid = Array.from(rows[4].children)
      .map((elem) => parseInt(elem.textContent, 10));

    const yes = Array.from(rows[6].children).map((elem) => {
      const b = elem.querySelector('b');
      if (!b) {
        return undefined;
      }

      return parseInt(b.textContent, 10);
    });
    const no = Array.from(rows[7].children).map((elem) => {
      const b = elem.querySelector('b');
      if (!b) {
        return undefined;
      }

      return parseInt(b.textContent, 10);
    });

    const out = [];
    for (const [ i, name ] of names.entries()) {
      out.push({
        name,
        id: ids[i],
        registered: registered[i] || 0,
        attended: attended[i] || 0,
        voted: voted[i] || 0,
        invalid: invalid[i] || 0,

        yes: yes[i] || 0,
        no: no[i] || 0,
      });
    }
    return out;
  });

  for (const line of stats) {
    const columns = {
      region: options.region,
      subregion: options.subregion,
      station: line.id,

      regionName: options.regionName,
      subregionName: options.subregionName,
      stationName: line.name,

      registered: line.registered,
      attended: line.attended,
      voted: line.voted,
      invalid: line.invalid,
      yes: line.yes,
      no: line.no,
    };

    stream.write(JSON.stringify(columns) + ',\n');
  }
}

async function main() {
  const stream = fs.createWriteStream('data.json');

  const browser = await puppeteer.launch({
    headless: false,
  });

  stream.write('[\n');

  const pool = new Pool(browser, POOL_SIZE);
  await pool.start();
  let regions;

  {
    const page = await pool.get();

    debug('fetching regions');
    await goto(page, ROOT_URI);
    const regionOptions = await page.$$eval(
      'form[name="go_reg"] option',
      (elems) => {
        return elems.map((elem) => {
          return { name: elem.textContent, value: elem.value };
        });
      });

    regions = regionOptions.map((option) => {
      const match = option.value.match(/&tvd=(\d+)/);
      if (!match) {
        return false;
      }

      return { name: option.name.trim(), region: match[1] };
    }).filter((x) => x);
    debug(`total region count: ${regions.length}`);

    pool.release(page);
  }

  for (const { name: regionName, region } of regions) {
    let subregions;

    if (EXCEPTION_REGIONS.includes(region)) {
      debug(`exceptional region: ${regionName}/${region}`);
      subregions = [ { name: regionName, subregion: region } ];
    } else {
      const page = await pool.get();

      debug(`loading region's root page: ${regionName}/${region}`);
      await goto(page, getRegionRoot(region));

      const subregionOptions = await page.$$eval(
        'form[name="go_reg"] option',
        (elems) => {
          return elems.map((elem) => {
            return { name: elem.textContent, value: elem.value };
          });
        });

      subregions = subregionOptions.map((option) => {
        const match = option.value.match(/&tvd=(\d+)/);
        if (!match) {
          return false;
        }

        return { name: option.name.trim(), subregion: match[1] };
      }).filter((x) => x);
      debug(`total subregion count: ${subregions.length}`);

      pool.release(page);
    }

    await Promise.all(subregions.map(async (entry) => {
      const { name: subregionName, subregion } = entry;
      const page = await pool.get();

      await loadSubregion(page, stream, {
        regionName,
        region,
        subregionName,
        subregion,
      });

      pool.release(page);
    }));
  }

  debug('done');
  stream.write('undefined\n');
  stream.end(']\n');
}

main().catch((e) => {
  console.error(e.stack);
});
