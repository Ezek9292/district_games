// PM2 process list used by deploy.sh. Both apps listen on localhost; Nginx sits in front (see DEPLOY.md).
const path = require("path");

module.exports = {
  apps: [
    {
      name: "church-games-api",
      cwd: path.join(__dirname, "backend"),
      script: "dist/index.js",
      env: { NODE_ENV: "production" },
    },
    {
      name: "church-games-web",
      cwd: path.join(__dirname, "frontend"),
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3000",
      env: { NODE_ENV: "production" },
    },
  ],
};
