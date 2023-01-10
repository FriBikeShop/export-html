const config = require('dotenv').config();
const app = require("./app");
const { getBrowser } = require("./utils/browser");

const PORT = process.env.BIND_PORT;
const HOST = process.env.BIND_HOST;

module.exports = (async () => {
  await getBrowser();

  app.listen(PORT, HOST, () => {
    console.info(`Started on port //${HOST}:${PORT}`);
  });
  return app;
})();
