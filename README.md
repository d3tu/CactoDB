# CactoDB

A simple JSON based line by line database written in Deno.

## Usage

```ts
import DB from "https://deno.land/x/cactodb/mod.ts"

interface User {
  name: string
}

const db = new DB<User>("users.db")

await db.init()

await db.insert({ name: "Cacto" })

const results = await db.select(({ name }) => name == "Cacto")

console.log("Results:", results)

const deletedCount = await db.delete(({ name }) => name == "Cacto")

console.log("Deleted Count:", deletedCount)
```