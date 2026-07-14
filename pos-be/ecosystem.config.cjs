module.exports = {
  apps: [
    {
      name: 'litepos-api',
      script: 'src/app.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      time: true,
      max_memory_restart: '450M',
      kill_timeout: 10000,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
