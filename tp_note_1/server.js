// Copie des données de départ : on ne modifie jamais le jeu de départ lui-même
const posts = structuredClone(require("./post.seed.js"));
const Koa = require("koa");
const Router = require("@koa/router");
const { bodyParser } = require("@koa/bodyparser");
const Joi = require("joi");
const app = new Koa();
const router = new Router();

const postFields = {
  id: Joi.any().forbidden(),
  postId: Joi.number().integer().min(1),
  name: Joi.string().max(100).pattern(/\S/),
  email: Joi.string()
    .max(100)
    .email({ tlds: { allow: false } }),
  body: Joi.string().max(500).pattern(/\S/),
};

const fullPostSchema = Joi.object(postFields)
  .required()
  .prefs({ presence: "required" });

const partialPostSchema = Joi.object(postFields).required().min(1);

const FIELD_ERRORS = {
  postId: "postId doit être un entier supérieur ou égal à 1",
  name: "name doit être un texte de 1 à 100 caractères",
  email: "email doit être une adresse e-mail valide de 100 caractères au plus",
  body: "body doit être un texte de 1 à 500 caractères",
};

const toErrorMessage = ({ type, path }) => {
  const [field] = path;
  switch (type) {
    case "object.base":
      return "Le corps de la requête doit être un objet JSON";
    case "object.unknown":
      return `Champ inconnu : ${field}`;
    case "object.min":
      return "Au moins un champ parmi postId, name, email, body est requis";
    case "any.unknown":
      return "Le champ id est attribué par le serveur et ne peut pas être fourni";
    case "any.required":
      return field
        ? `Champ manquant : ${field}`
        : "Le corps de la requête doit être un objet JSON";
    default:
      return FIELD_ERRORS[field] ?? "Requête invalide";
  }
};

const validatePost = (ctx, schema) => {
  // convert: false => "1" n'est pas accepté comme entier
  const { error, value } = schema.validate(ctx.request.body, {
    convert: false,
  });
  if (error) ctx.throw(400, toErrorMessage(error.details[0]));
  return value;
};

const parseId = (ctx, raw, label = "Id de post invalide") => {
  const id = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(id) || id < 1) ctx.throw(400, label);
  return id;
};

const findPostIndex = (ctx, id) => {
  const index = posts.findIndex((p) => p.id === id);
  if (index === -1) ctx.throw(404, "Aucun post ne correspond à cet id");
  return index;
};

app.use(async (ctx, next) => {
  const debut = Date.now();
  await next();
  console.log(
    `${ctx.method} ${ctx.path} -> ${ctx.status} (${Date.now() - debut} ms)`,
  );
});

app.use(async (ctx, next) => {
  try {
    await next();
    if (ctx.status === 404 && !ctx.body) ctx.throw(404, "Route introuvable");
  } catch (err) {
    console.error(err);
    ctx.status = isClientError ? err.status : 500;
    ctx.body = {
      error: isClientError ? err.message : "Erreur interne du serveur",
    };
  }
});

app.use(
  bodyParser({
    enableTypes: ["json"],
    jsonLimit: "10kb",
    onError: (err, ctx) =>
      ctx.throw(
        err.status,
        err.status === 413
          ? "Corps de la requête trop volumineux"
          : "JSON invalide",
      ),
  }),
);

router.get("/posts", (ctx) => {
  const { postId } = ctx.query;

  if (postId === undefined) {
    ctx.body = posts;
    return;
  }

  const selectedPostId = parseId(ctx, postId, "postId invalide");
  ctx.body = posts.filter((p) => p.postId === selectedPostId);
});

router.get("/posts/:id", (ctx) => {
  const id = parseId(ctx, ctx.params.id);
  const index = findPostIndex(ctx, id);
  ctx.body = posts[index];
});

router.post("/posts", (ctx) => {
  const data = validatePost(ctx, fullPostSchema);

  const newPost = {
    id: Math.max(0, ...posts.map((p) => p.id)) + 1,
    ...data,
  };
  posts.push(newPost);

  ctx.status = 201;
  ctx.set("Location", `/posts/${newPost.id}`);
  ctx.body = newPost;
});

router.put("/posts/:id", (ctx) => {
  const id = parseId(ctx, ctx.params.id);
  const index = findPostIndex(ctx, id);
  const data = validatePost(ctx, fullPostSchema);

  const updatedPost = { id, ...data };
  posts[index] = updatedPost;

  ctx.body = updatedPost;
});

router.patch("/posts/:id", (ctx) => {
  const id = parseId(ctx, ctx.params.id);
  const index = findPostIndex(ctx, id);
  const changes = validatePost(ctx, partialPostSchema);

  const updatedPost = { ...posts[index], ...changes, id };
  posts[index] = updatedPost;

  ctx.body = updatedPost;
});

router.delete("/posts/:id", (ctx) => {
  const id = parseId(ctx, ctx.params.id);
  const index = findPostIndex(ctx, id);

  posts.splice(index, 1);
  ctx.status = 204;
});

app.use(router.routes()).use(router.allowedMethods({ throw: true }));
app.listen(3000);
