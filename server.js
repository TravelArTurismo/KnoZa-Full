require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// Configuración de CORS para producción y desarrollo
const corsOptions = {
  origin: [
    'https://knoza.onrender.com',
    'http://localhost:3001'
  ],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Conexión a PostgreSQL
const db = new Pool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false
  }
});

// Verificar conexión a la BD
db.connect()
  .then(() => console.log('✅ Conectado a PostgreSQL'))
  .catch(err => console.error('❌ Error de conexión:', err));

// Rutas de la API
app.post('/api/entry-exit', async (req, res) => {
  const { employee_id, date, entry_time, exit_time, timestamp } = req.body;
  try {
    await db.query(
      `INSERT INTO entry_exit (employee_id, date, entry_time, exit_time, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [employee_id, date, entry_time, exit_time, timestamp]
    );
    res.json({ success: true, message: 'Registro guardado' });
  } catch (err) {
    console.error('Error al guardar entrada/salida:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.patch('/api/entry-exit/:id', async (req, res) => {
  const { exit_time } = req.body;
  try {
    const result = await db.query(
      'UPDATE entry_exit SET exit_time = $1 WHERE id = $2',
      [exit_time, req.params.id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json({ success: true, message: 'Salida registrada' });
  } catch (err) {
    console.error('Error al actualizar salida:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

app.get('/api/entry-exit', async (req, res) => {
  const { employee_id, date } = req.query;
  let query = 'SELECT * FROM entry_exit';
  let params = [];

  if (employee_id && date) {
    query += ' WHERE employee_id = $1 AND date = $2';
    params = [employee_id, date];
  }
  query += ' ORDER BY date DESC, entry_time DESC';

  try {
    const results = await db.query(query, params);
    res.json(results.rows);
  } catch (err) {
    console.error('Error al leer registros:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Rutas para descansos (similar a las anteriores)
app.post('/api/breaks', async (req, res) => {
  const { employee_id, date, break_type, duration, timestamp } = req.body;
  try {
    await db.query(
      `INSERT INTO breaks (employee_id, date, break_type, duration, timestamp)
       VALUES ($1, $2, $3, $4, $5)`,
      [employee_id, date, break_type, duration, timestamp]
    );
    res.json({ success: true, message: 'Descanso registrado' });
  } catch (err) {
    console.error('Error al guardar descanso:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});