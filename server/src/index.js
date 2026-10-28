const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { authRequired } = require('./middleware/auth');

const authRouter = require('./routes/auth');
const zonesRouter = require('./routes/zones');
const containersRouter = require('./routes/containers');
const batchesRouter = require('./routes/batches');
const plantsRouter = require('./routes/plants');
const statsRouter = require('./routes/stats');
const exportRouter = require('./routes/export');
const demoRouter = require('./routes/demo');

const app = express();
app.use(cors());
app.use(express.json());

// Публичные роуты
app.use('/api/auth', authRouter);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Защищённые роуты
app.use('/api/zones', authRequired, zonesRouter);
app.use('/api/containers', authRequired, containersRouter);
app.use('/api/batches', authRequired, batchesRouter);
app.use('/api/plants', authRequired, plantsRouter);
app.use('/api/stats', authRequired, statsRouter);
app.use('/api/export', authRequired, exportRouter);
app.use('/api/demo', authRequired, demoRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});