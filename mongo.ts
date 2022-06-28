import { MongoClient } from "https://deno.land/x/mongo@v0.30.0/mod.ts"
import { isProd } from './isprod.ts'

export async function connect(): Promise<MongoClient> {
  const client = new MongoClient()

  if (isProd()) {
    // // First unpack cert from env
    // if (Deno.env.get('CERT') === undefined) throw new Error('Please provide a MongoDB certificate.')
    // const cert = Deno.env.get('CERT')?.replaceAll('\\n', '\n')
    // await Deno.writeTextFile('cert.pem', cert ?? '')

    await client.connect({
      db: 'wishlily',
      retryWrites: true,
      tls: true,
      servers: [
        {
          host: 'cluster0-shard-00-00.rqmyk.mongodb.net',
          port: 27017,
        },
        {
          host: 'cluster0-shard-00-01.rqmyk.mongodb.net',
          port: 27017,
        },
        {
          host: 'cluster0-shard-00-02.rqmyk.mongodb.net',
          port: 27017,
        },
      ],
      credential: {
        username: Deno.env.get('MONGO_USER'),
        password: Deno.env.get('MONGO_PWD'),
        db: 'wishlily',
        mechanism: 'SCRAM-SHA-1',
      },
    })
  } else {
    await client.connect("mongodb://127.0.0.1:27017")
  }

  return client
}
