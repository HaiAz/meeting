export function randomCode() {
  const chars = "abcdefghijklmnopqrstuvwxyz"
  const pattern = [3, 4, 3]
  const blk = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  return pattern.map(blk).join("-")
}