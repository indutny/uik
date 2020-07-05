# UIK

Voting data for [2020 Russian Constitutional Referedum][referendum].

## How to collect

```sh
git clone git://github.com/indutny/uik
cd uik
npm install
node scrape.js
```

The script will open a browser window (using [puppeteer][]) and will ask you
to enter captcha (likely only once). All data will be written to `data.csv` file
in the current working directory.

_(NOTE: Since data is downloaded using 16 browser windows - its order might
differ from the one in this repository. You can check that the data is the same
by sorting the rows of the csv file)_

## LICENSE

This software is licensed under the MIT License.

Copyright Fedor Indutny, 2020.

Permission is hereby granted, free of charge, to any person obtaining a
copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to permit
persons to whom the Software is furnished to do so, subject to the
following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
USE OR OTHER DEALINGS IN THE SOFTWARE.

[referendum]: http://www.vybory.izbirkom.ru/region/izbirkom?action=show&global=1&vrn=100100163596966&region=0&prver=0&pronetvd=null
[puppeteer]: https://github.com/puppeteer/puppeteer
