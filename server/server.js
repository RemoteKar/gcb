const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

// /user/:name — OG 메타태그 삽입용 (netlify.toml 리다이렉트로 진입)
app.use('/user', require('./routes/userPage'));

if (require.main === module) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`GCB API server listening on http://localhost:${port}`);
  });
}

module.exports.app = app;
module.exports.handler = serverless(app);
