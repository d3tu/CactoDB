const NEW_LINE = "\n"
const NEW_LINE_CHAR = NEW_LINE.charCodeAt(0)
const SPACE = " "
const SPACE_CHAR = SPACE.charCodeAt(0)

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export type Query<T> = (data: T) => Promise<boolean> | boolean

export default class DB<T> {
  #path: string | URL
  #file!: Deno.FsFile
  #ready = false
  #loading = false
  #pos = 0
  #buf = new Uint8Array(4096)

  constructor(path: string | URL) {
    this.#path = path
  }

  async init() {
    if (this.#loading) throw new Error("AlreadyCalled")
    if (this.#ready) throw new Error("AlreadyStarted")

    this.#loading = true

    this.#file = await Deno.open(this.#path, {
      read: true,
      write: true,
      create: true
    })

    this.#ready = true
    this.#loading = false
  }

  async insert(data: Partial<T>) {
    if (this.#loading) throw new Error("WaitToStart")
    if (!this.#ready) throw new Error("NotStarted")

    await this.#file.seek(0, Deno.SeekMode.End)
    await this.#file.write(encoder.encode(JSON.stringify(data) + NEW_LINE))
  }

  async select(query: Query<Partial<T>>) {
    if (this.#loading) throw new Error("WaitToStart")
    if (!this.#ready) throw new Error("NotStarted")

    const list: Partial<T>[] = []

    for await (let line of this.#readLines()) {
      if (!(line = line.trim())) continue
      const data = JSON.parse(line) as Partial<T>
      if (await query(data)) list.push(data)
    }

    return list
  }

  async delete(query: Query<Partial<T>>) {
    if (this.#loading) throw new Error("WaitToStart")
    if (!this.#ready) throw new Error("NotStarted")

    const pointers: [number, number][] = []

    let before!: number, after!: number

    const trim = (str: string) => {
      before = 0
      after = str.length - 1

      while (before <= after && /\s/.test(str[before])) before++
      while (after >= before && /\s/.test(str[after])) after--

      return str.substring(before, after + 1)
    }

    let last = 0

    for await (let line of this.#readLines()) {
      if ((line = trim(line))) {
        if (await query(JSON.parse(line) as Partial<T>)) {
          pointers.push([last + before, line.length])
        }
      }

      last = this.#pos
    }

    for (const [pos, size] of pointers) {
      await this.#file.seek(pos, Deno.SeekMode.Start)
      await this.#file.write(new Uint8Array(size).fill(SPACE_CHAR))
    }

    return pointers.length
  }

  async *#readLines() {
    let size: number | null
    let line = ""

    await this.#file.seek(this.#pos = 0, Deno.SeekMode.Start)

    while ((size = await this.#file.read(this.#buf))) {
      let last = 0

      for (let i = 0; i < size; i++) {
        if (this.#buf[i] == NEW_LINE_CHAR) {
          this.#pos += i - last + 1
          yield line + decoder.decode(this.#buf.subarray(last, i))
          last = i + 1
          line = ""
        }
      }

      line += decoder.decode(this.#buf.subarray(last, size))
      this.#pos += size - last
    }

    yield line
  }
}