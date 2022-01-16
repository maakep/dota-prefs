module.exports = {
  apps: [
    {
      name: "dota-prefs",
      script: "npm run startup",
      env_hook: {
        command: "git pull && pm2 restart dota-prefs",
        cwd: "/home/pi/projects/dota-prefs",
      },
    },
  ],
};
