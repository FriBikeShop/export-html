const Router = require("@koa/router");
const Koa = require("koa");
const bodyParser = require("koa-body");
const validate = require("./utils/middleware/validate");
const errorHandler = require("./utils/middleware/error-handler");
const { version } = require("../package.json");
const logger = require('koa-logger')

const Joi = require("joi");

const { getBrowser } = require("./utils/browser");

const app = new Koa();


app
  .use(bodyParser({ multipart: true }))
  .use(logger())
  .use(errorHandler);

const router = new Router();
app.router = router;

router.get("/", (ctx) => {
  ctx.body = {
    environment: process.env.ENV_NAME,
    version,
    servedAt: new Date(),
  };
});


// https://pptr.dev/#?product=Puppeteer&version=v8.0.0&show=api-pagescreenshotoptions
router.post(
  "/1/screenshot",
  validate({
    body: Joi.object({
      html: Joi.string().required(),
      export: Joi.object({
        scale: Joi.number().min(0.1).max(2).default(1),
        type: Joi.string().allow("jpeg", "png").default("png"),
        quality: Joi.number().min(0).max(100).default(100),
        fullPage: Joi.boolean().default(true),
        clip: Joi.object({
          x: Joi.number(),
          y: Joi.number(),
          width: Joi.number(),
          height: Joi.number(),
        }),
        omitBackground: Joi.boolean().default(false),
        encoding: Joi.string().allow("base64", "binary").default("binary"),
      }),
    }),
  }),
  async (ctx) => {
    const body = ctx.request.body;
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setContent(body.html, { waitUntil: "load" });
    const options = body.export;
    if (options.type === "png") {
      delete options.quality;
    }
    ctx.body = await page.screenshot(options);
    await page.close();
  }
);

// https://pptr.dev/#?product=Puppeteer&version=v8.0.0&show=api-pagepdfoptions
router.post(
  "/1/pdf",
  validate({
    body: Joi.object({
      html: Joi.string().required(),
      export: Joi.object({
        scale: Joi.number().default(1),
        displayHeaderFooter: Joi.boolean().default(true),
        headerTemplate: Joi.string(),
        footerTemplate: Joi.string(),
        printBackground: Joi.boolean().default(true),
        landscape: Joi.boolean().default(false),
        pageRanges: Joi.string(),
        width: Joi.string(),
        height: Joi.string(),
        format: Joi.string()
          .valid(
            "Letter",
            "Legal",
            "Tabloid",
            "Ledger",
            "A0",
            "A1",
            "A2",
            "A3",
            "A4",
            "A5",
            "A6"
          )
          .default("Letter"),
        margin: Joi.object({
          top: Joi.string(),
          right: Joi.string(),
          bottom: Joi.string(),
          left: Joi.string(),
        }),
        preferCSSPageSize: Joi.boolean().default(false),
      }),
    }),
  }),
  async (ctx) => {
    const body = ctx.request.body;
    const browser = await getBrowser();
    const page = await browser.newPage();

    await page.setContent(body.html, { waitUntil: "load" });
    ctx.body = await page.pdf(body.export);
    await page.close();
  }
);

app.use(router.routes());
app.use(router.allowedMethods());

app.on("error", (err, ctx) => {
  // dont output stacktraces of errors that is throw with status as they are known
  if (!err.status || err.status === 500) {
    ctx.logger.error(err);
    Sentry.withScope(function (scope) {
      scope.addEventProcessor(function (event) {
        return Sentry.Handlers.parseRequest(event, ctx.request);
      });
      Sentry.captureException(err);
    });
  }
});

module.exports = app;