const Koa = require('koa');
const Router = require('@koa/router');
const app = new Koa();
const router = new Router()
const exemples = [
  {id: 1, nom: "Task1", done: 'false'},
  {id: 2, nom: "Task2", done: 'false'},
  {id: 3, nom: "Task3", done: 'false'},
  {id: 4, nom: "Task4", done: 'false'},
]

app.use(async (ctx, next) => {
  const debut = Date.now()
  await next()
  console.log(`${ctx.method} ${ctx.path} -> ${ctx.status} (${Date.now() - debut} ms)`)
})

router.get("/examples", (ctx) => {
  const { done } = ctx.query
  if (done !== "true" && done !== "false") {
    ctx.status = 400
    return
  }
  ctx.status = 200
  ctx.body = exemples.filter((e) => e.done === done)
})

router.get("/count", (ctx) => {
  ctx.body = {
    "count": exemples.length
  }
})

app.use(router.routes()).use(router.allowedMethods())
app.listen(3000);
