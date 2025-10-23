module.exports = {
  apps: [
    {
      name: "whatsappbot",
      script: "server.js", // Your application entry file
      cwd: "/Users/kapilsingh/Desktop/zeepty-work/Auto/whatsapp-bot/Broadcast/whatsapp-web-bot",
      env: {
        NODE_ENV: "development",
        JWT_SECRET: "sfsafweljwerjwel",
      },
      // Or a specific environment like 'production'
      env_production: {
        NODE_ENV: "production",
        JWT_SECRET: "sfsafweljwerjwel",
      },
    },
  ],
};
