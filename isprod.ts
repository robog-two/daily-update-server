export function isProd(): boolean {
  return Deno.env.get('ENVIRONMENT') === 'production'
}

export async function domain(product: string): Promise<string> {
  const which = (await isProd()) ? 0 : 1
  return ({
    mathilda: ['https://proxy.wishlily.app', 'http://127.0.0.1:8080'],
    db: ['https://db.wishlily.app', 'http://127.0.0.1:8081'],
    'db-ws': ['wss://db.wishlily.app', 'ws://127.0.0.1:8081'],
  })[product]?.[which] ?? 'wishlily.app'
}
