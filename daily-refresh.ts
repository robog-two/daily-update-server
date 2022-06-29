import { connect as getMongo } from './mongo.ts'
import { isProd } from './isprod.ts'

if (isProd()) console.log('Environment is production.')

let lastStart = 0
let queue: Array<string | undefined> = []
const mongo = await getMongo()
const products = await mongo.database('wishlily').collection('products')

function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

interface Embed {
  link: string | undefined
  title: string | undefined
  price: string | undefined
  cover: string | undefined
  message: string | undefined
  success: boolean | undefined
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

    queue = shuffle(queue)
  }

  const domains: Array<string> = []
  let tries = 0
  queue = (await Promise.all(queue.map(async (link) => {
    try {
      if (!link) return link
      if (tries > 5) {
        return link
      } else {
        tries++
      }
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
        if (newEmbed?.success == false && newEmbed?.message == 'Rate limit exceeded. Try again in 5 minutes.') {
          // If we're rate limited (likely bc people are slammin the api)
          // wait 5 minutes and try again
          return link
        }
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

// This stuff should run every five minutes + 10 sec
setInterval(embedOneSet, 310000)
embedOneSet()
