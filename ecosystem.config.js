module.exports = {
  apps: [
    {
      name: "dota-prefs",
      script: "./dist/index.js",
      env_hook: {
        command: "git pull && npm i && pm2 restart dota-prefs",
        cwd: "/home/pi/projects/dota-prefs",
      },
    },
  ],
};
