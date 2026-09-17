const express = require('express');
const cors = require('cors');
require('dotenv').config();

const containersRouter = require('./routes/containers');  // ← добавляем импорт

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});


app.use('/api/containers', containersRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});