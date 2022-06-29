import { connect as getMongo } from './mongo.ts'
import { isProd } from './isprod.ts'

if (isProd()) console.log('Environment is production.')

let lastStart = 0
let queue: Array<string | undefined> = []
const mongo = await getMongo()
const products = await mongo.database('wishlily').collection('products')

interface Embed {
  link: string | undefined
  title: string | undefined
  price: string | undefined
  cover: string | undefined
}

async function embedOneSet() {
  if (queue.length === 0) {
    // Only embed again once per 24h (only happens if it takes less than 24h to embed all products)
    if (lastStart < Date.now() - 1000 * 60 * 60 * 24) {
      lastStart = Date.now()
    } else {
      return
    }

    console.log('Starting embed updates')

    await products.find({}).forEach(it => {
      if (!queue.includes(it.link)) {
        queue.push(it.link)
      }
    })
  }

  const domains: Array<string> = []
  queue = (await Promise.all(queue.map(async (link) => {
    try {
      if (!link) return link
      let url: URL | undefined
      try {
        url = new URL(link)
      } catch (e) {
        console.log(e)
      }
      if (!url) return link

      if (domains.includes(url.host)) {
        return link
      } else {
        domains.push(url.host)
        console.log(` -> ${link}`)
        const newEmbed: Embed | undefined = await (await fetch(`${isProd() ? 'https://proxy.wishlily.app' : 'http://localhost:8080'}/generic/product?id=${encodeURIComponent(link)}`)).json() as Embed | undefined
        if (newEmbed) {
          const { title, price, cover } = newEmbed

          if (link) {
            console.log(newEmbed)
            mongo.database('wishlily').collection(`products`).updateOne(
              { link },
              {
                $set: {
                  link: newEmbed?.link,
                  title,
                  price,
                  cover
                }
              },
              { upsert: true, }
            )
          }
        }

        return undefined
      }
    } catch (e) {
      console.error(e)
      // We'll try again tomorrow
      return undefined
    }
  }))).filter(it => it !== undefined)
}

// This stuff should run every five minutes!
setInterval(embedOneSet, 300000)
embedOneSet()
