module.exports = {
  apps: [
    {
      name: "ceprija-site",
      script: "./dist/server/entry.mjs",
      node_args: "--env-file=.env",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "4321",
      },
      max_memory_restart: "512M",
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
