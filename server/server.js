const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

module.exports.handler = serverless(app);