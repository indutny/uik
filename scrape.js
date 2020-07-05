'use strict';

const puppeteer = require('puppeteer');
const read = require('read');
const debug = require('debug')('uik');
const { spawnSync } = require('child_process');
const fs = require('fs');

const POOL_SIZE = 16;

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

  const stationsSelector = 'table table div > table tr:nth-child(1) td';
  const stations = await page.$$eval(stationsSelector, (columns) => {
    return columns.map((column) => {
      const a = column.querySelector('a');
      return {
        id: a.href.match(/&vibid=(\d+)/)[1],
        name: a.textContent.trim(),
      };
    });
  });

  const leftColumnSelector = 'table table td > table[align="left"] ' +
    'tr:not(:nth-child(1)) td:nth-child(3)';
  const left = await page.$$eval(leftColumnSelector, (rows) => {
    return rows.map((row) => {
      const b = row.querySelector('b');

      return b ? b.textContent.trim() : undefined;
    });
  });
  if (left.length % 7 !== 0) {
    throw new Error('Unexpected overflow columns length!');
  }

  const overflow = [];
  for (let i = 7; i < left.length; i += 7) {
    overflow.push(left.slice(i, i + 7));
  }

  const rightRowSelector = 'table table div > table tr:not(:nth-child(1))';
  const right = await page.$$eval(rightRowSelector, (rows) => {
    if (rows.length % 7 !== 0) {
      throw new Error('Unexpected rows length!');
    }

    const out = [];
    for (let i = 0; i < rows.length; i += 7) {
      const chunk = rows.slice(i, i + 7);
      const columns = [];

      // NOTE: Skip #4, because it is empty
      let min = Math.min(
        chunk[0].children.length,
        chunk[1].children.length,
        chunk[2].children.length,
        chunk[3].children.length,
        chunk[5].children.length,
        chunk[6].children.length);

      for (let j = 0; j < min; j++) {
        columns.push(chunk.map((row) => {
          if (!row.children[j]) {
            return undefined;
          }
          const b = row.children[j].querySelector('b');

          return b ? b.textContent.trim() : undefined;
        }));
      }

      // Skip empty columns
      if (columns.length === 0) {
        continue;
      }

      out.push(columns);
    }
    return out;
  });

  let merged = [];
  for (const columns of right) {
    merged = merged.concat(columns);
    if (overflow.length !== 0) {
      merged = merged.concat([ overflow.shift() ]);
    }
  }
  while (overflow.length !== 0) {
    merged = merged.concat([ overflow.shift() ]);
  }

  if (merged.length !== stations.length) {
    throw new Error(`Unexpected station/merged mismatch: ` +
      `${merged.length} != ${stations.length}`);
  }

  const stats = stations.map(({ name, id }, i) => {
    const column = merged[i];
    return {
      name,
      id,
      registered: parseInt(column[0], 10),
      attended: parseInt(column[1], 10),
      voted: parseInt(column[2], 10),
      invalid: parseInt(column[3], 10),
      yes: parseInt(column[5], 10),
      no: parseInt(column[6], 10),
    };
  });

  for (const line of stats) {
    const columns = [
      options.region,
      options.subregion,
      line.id,

      options.regionName,
      options.subregionName,
      line.name,

      line.registered,
      line.attended,
      line.voted,
      line.invalid,
      line.yes,
      line.no,
    ];

    const csv = columns.map((column) => {
      if (typeof column === 'string') {
        return JSON.stringify(column);
      } else if (column === undefined) {
        console.error(columns);
        throw new Error('wtf?');
      } else {
        return column.toString();
      }
    });

    stream.write(csv.join(',') + '\n');
  }
}

async function main() {
  const stream = fs.createWriteStream('data.csv');

  const browser = await puppeteer.launch({
    headless: false,
  });

  stream.write('region id,subregion id,station id,region name,' +
    'subregion name,station name,registered,attended,' +
    'voted,invalid,yes,no\n');

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
  stream.close();

  await browser.close();
}

main().catch((e) => {
  console.error(e.stack);
});
