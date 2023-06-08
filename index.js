require('dotenv').config()
const puppeteer = require('puppeteer')
const { createTransport } = require('nodemailer')

const sleep = require('./sleep.js')
const transportConfig = require('./transportConfig.js')
const games = require('./gamesList.js')

const ONE_SECOND_IN_MS = 1000
const FIFTEEN_MINUTES_IN_MS = 900000

const fetchGamePrice = async (page, { url, title }) => {
  const res = await page.goto(url, { waitUntil: 'domcontentloaded' })
  await sleep(ONE_SECOND_IN_MS)
  console.log(res.status())

  const games = await page.$$eval(
    '[class*="BasicTilestyles__TileLower"], [class^="BasicTilestyles__TileLower"]',
    els => els.map(el => el.textContent)
  )
  const game = games.find(game => game.includes(title) && !game.toLowerCase().includes('demo'))
  if (!game) return new Error(`${title} not found`)

  const price = game.match(/\$[.\d]+/g)
  if (!price) return 9999

  console.log(`${title} Price: ${price}`)
  return parseFloat(price[0].replace('$', ''))
}

const createEmailMessage = async ({ title, price }) => {
  return {
    from: 'evan@evankwan.com',
    to: 'evanyuekwan@gmail.com',
    replyTo: 'evanyuekwan@gmail.com',
    subject: `🔥🔥🔥 ${title} is on sale for ${price} 🔥🔥`,
    html: `<p>${title} is on sale for <b>${price}</b></p>`,
    headers: [
      { key: 'X-Application-Developer', value: 'Evan Kwan' },
      { key: 'X-Application-Version', value: 'v1.0.0.0' },
    ],
  }
}

const handleSale = async (game, salesIdentified) => {
  if (salesIdentified.includes(game.title)) return
  salesIdentified.push(game.title)
  console.log(`sale identified for ${game.title}`)

  const message = await createEmailMessage(game)
  const transport = createTransport(transportConfig)
  transport.sendMail(message)

}

const main = async () => {
  const browser = await puppeteer.launch({ headless: 'new' })
  const salesIdentified = [];

  let loop = 0;
  const scrape = async () => {
    const TIMER_NAME = `run ${loop}`
    console.time(TIMER_NAME)
    loop++
    const gamesOnSale = []
    for (const { url, title, targetPrice } of games) {
      let page;
      try {
        page = await browser.newPage()
        const price = await fetchGamePrice(page, { url, title })

        const isLowerThanOrAtTargetPrice = price <= targetPrice
        if (isLowerThanOrAtTargetPrice) gamesOnSale.push({ title, price })
      } catch (error) {
        console.error(`error with ${title}`, error)
      } finally {
        await page.close()
      }
    }

    try {
      if (!gamesOnSale.length) return
      gamesOnSale.forEach(sale => handleSale(sale, salesIdentified))
    } catch (error) {
      console.error('error handling sale')
    } finally {
      console.timeEnd(TIMER_NAME)
    }
  }

  scrape()
  setInterval(scrape, FIFTEEN_MINUTES_IN_MS)
}

main()