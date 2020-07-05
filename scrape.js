'use strict';

const puppeteer = require('puppeteer');
const read = require('read');
const debug = require('debug')('uik');
const { spawnSync } = require('child_process');
const fs = require('fs');

const ROOT_URI = 'http://www.vybory.izbirkom.ru/region/region/izbirkom?' +
  'action=show&root=1&tvd=100100163596969&vrn=100100163596966';

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
    const ids = Array.from(rows[0].children).map((elem) => {
      return elem.querySelector('a').href.match(/&vibid=(\d+)/)[1];
    });

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
        id: ids[i],
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
      options.region,
      options.subregion,
      line.id,

      options.regionName,
      options.subregionName,
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
  stream.write('region name, subregion name, station name, region id, ' +
    'subregion id, station id, registered, came, voted, invalid, yes, no\n');

  debug('fetching regions');
  await goto(page, ROOT_URI);
  const regionOptions = await page.$$eval(
    'form[name="go_reg"] option',
    (elems) => {
      return elems.map((elem) => {
        return { name: elem.textContent, value: elem.value };
      });
    });

  const regions = regionOptions.map((option) => {
    const match = option.value.match(/&tvd=(\d+)/);
    if (!match) {
      return false;
    }

    return { name: option.name, region: match[1] };
  }).filter((x) => x);
  debug(`total region count: ${regions.length}`);

  for (const { name: regionName, region } of regions) {
    debug(`loading region's root page: ${regionName}/${region}`);
    await goto(page, getRegionRoot(region));

    const subregionOptions = await page.$$eval(
      'form[name="go_reg"] option',
      (elems) => {
        return elems.map((elem) => {
          return { name: elem.textContent, value: elem.value };
        });
      });

    const subregions = subregionOptions.map((option) => {
      const match = option.value.match(/&tvd=(\d+)/);
      if (!match) {
        return false;
      }

      return { name: option.name, subregion: match[1] };
    }).filter((x) => x);
    debug(`total subregion count: ${subregions.length}`);

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
