require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();

// Middleware para logging de todas las peticiones
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Configuración mejorada de CORS
const corsOptions = {
  origin: [
    'https://knoza.onrender.com',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5500'
  ],
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Conexión a PostgreSQL con manejo mejorado de errores
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 5432,
  ssl: {
    rejectUnauthorized: false
  },
  // Configuración adicional para mejorar la conexión
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20
};

const db = new Pool(dbConfig);

// Verificación mejorada de conexión a la BD
db.connect()
  .then(client => {
    console.log('✅ Conectado a PostgreSQL');
    // Verificar si las tablas existen
    return client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'entry_exit'
      ) as entry_exit_exists,
      EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'breaks'
      ) as breaks_exists
    `)
    .then(res => {
      console.log('Verificación de tablas:');
      console.log('- Tabla entry_exit existe:', res.rows[0].entry_exit_exists);
      console.log('- Tabla breaks existe:', res.rows[0].breaks_exists);
      client.release();
    })
    .catch(err => {
      console.error('❌ Error al verificar tablas:', err);
      client.release();
    });
  })
  .catch(err => {
    console.error('❌ Error de conexión a PostgreSQL:', err);
    process.exit(1);
  });

// Ruta de verificación de salud
app.get('/api/healthcheck', (req, res) => {
  db.query('SELECT 1')
    .then(() => res.json({ 
      status: 'ok', 
      message: 'API funcionando',
      database: 'conectado'
    }))
    .catch(err => res.status(500).json({ 
      status: 'error',
      message: 'Error de base de datos',
      details: err.message 
    }));
});

// ==============================================
// RUTAS MEJORADAS PARA ENTRADAS/SALIDAS
// ==============================================
app.post('/api/entry-exit', async (req, res) => {
  const { employee_id, date, entry_time, exit_time, timestamp } = req.body;
  
  // Validación básica
  if (!employee_id || !date) {
    return res.status(400).json({ 
      error: 'Datos incompletos',
      details: 'Se requieren employee_id y date'
    });
  }

  try {
    // Verificar si ya tiene una entrada sin salida
    const existingRecords = await db.query(
      'SELECT * FROM entry_exit WHERE employee_id = $1 AND date = $2 AND exit_time IS NULL',
      [employee_id, date]
    );

    if (existingRecords.rows.length > 0) {
      return res.status(400).json({ 
        error: 'Entrada duplicada',
        message: 'Ya tienes una entrada registrada hoy sin salida'
      });
    }

    // Insertar nueva entrada
    const result = await db.query(
      `INSERT INTO entry_exit 
       (employee_id, date, entry_time, exit_time, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [employee_id, date, entry_time || null, exit_time || null, timestamp || Date.now()]
    );

    res.json({ 
      success: true, 
      message: 'Registro guardado',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error al guardar entrada/salida:', err);
    res.status(500).json({ 
      error: 'Error en el servidor',
      details: err.message,
      hint: 'Verifica que la tabla entry_exit exista y tenga la estructura correcta'
    });
  }
});

app.patch('/api/entry-exit/:id', async (req, res) => {
  const { exit_time } = req.body;

  if (!exit_time) {
    return res.status(400).json({ error: 'Se requiere exit_time' });
  }

  try {
    const result = await db.query(
      `UPDATE entry_exit 
       SET exit_time = $1 
       WHERE id = $2
       RETURNING *`,
      [exit_time, req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ 
        error: 'Registro no encontrado',
        hint: 'Verifica que el ID exista en la base de datos'
      });
    }

    res.json({ 
      success: true, 
      message: 'Salida registrada',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error al actualizar salida:', err);
    res.status(500).json({ 
      error: 'Error en el servidor',
      details: err.message
    });
  }
});

app.get('/api/entry-exit', async (req, res) => {
  const { employee_id, date } = req.query;

  try {
    let query = 'SELECT * FROM entry_exit';
    let params = [];
    let paramCount = 1;

    if (employee_id && date) {
      query += ` WHERE employee_id = $${paramCount++} AND date = $${paramCount++}`;
      params.push(employee_id, date);
    } else if (employee_id) {
      query += ` WHERE employee_id = $${paramCount++}`;
      params.push(employee_id);
    } else if (date) {
      query += ` WHERE date = $${paramCount++}`;
      params.push(date);
    }

    query += ' ORDER BY date DESC, entry_time DESC';

    const results = await db.query(query, params);
    res.json(results.rows);
  } catch (err) {
    console.error('Error al leer registros:', err);
    res.status(500).json({ 
      error: 'Error en el servidor',
      details: err.message,
      hint: 'Verifica los parámetros de búsqueda'
    });
  }
});

// ==============================================
// RUTAS MEJORADAS PARA DESCANSO
// ==============================================
app.post('/api/breaks', async (req, res) => {
  const { employee_id, date, break_type, duration, timestamp } = req.body;

  // Validación básica
  if (!employee_id || !date || !duration) {
    return res.status(400).json({ 
      error: 'Datos incompletos',
      details: 'Se requieren employee_id, date y duration'
    });
  }

  try {
    const result = await db.query(
      `INSERT INTO breaks 
       (employee_id, date, break_type, duration, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        employee_id, 
        date, 
        break_type || 'General',
        duration,
        timestamp || Date.now()
      ]
    );

    res.json({ 
      success: true, 
      message: 'Descanso registrado',
      data: result.rows[0]
    });
  } catch (err) {
    console.error('Error al guardar descanso:', err);
    res.status(500).json({ 
      error: 'Error en el servidor',
      details: err.message,
      hint: 'Verifica que la tabla breaks exista y tenga la estructura correcta'
    });
  }
});

app.get('/api/breaks', async (req, res) => {
  const { employee_id, date } = req.query;

  try {
    let query = 'SELECT * FROM breaks';
    let params = [];
    let paramCount = 1;

    if (employee_id && date) {
      query += ` WHERE employee_id = $${paramCount++} AND date = $${paramCount++}`;
      params.push(employee_id, date);
    } else if (employee_id) {
      query += ` WHERE employee_id = $${paramCount++}`;
      params.push(employee_id);
    } else if (date) {
      query += ` WHERE date = $${paramCount++}`;
      params.push(date);
    }

    query += ' ORDER BY date DESC, timestamp DESC';

    const results = await db.query(query, params);
    res.json(results.rows);
  } catch (err) {
    console.error('Error al leer descansos:', err);
    res.status(500).json({ 
      error: 'Error en el servidor',
      details: err.message
    });
  }
});

app.delete('/api/breaks/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM breaks WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ 
        error: 'Registro no encontrado',
        hint: 'Verifica que el ID exista en la base de datos'
      });
    }

    res.json({ 
      success: true, 
      message: 'Descanso eliminado',
      deleted: result.rows[0]
    });
  } catch (err) {
    console.error('Error al eliminar descanso:', err);
    res.status(500).json({ 
      error: 'Error en el servidor',
      details: err.message
    });
  }
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).json({
    error: 'Error interno del servidor',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Ruta para manejar 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Ruta no encontrada',
    path: req.originalUrl,
    method: req.method,
    availableRoutes: [
      'POST /api/entry-exit',
      'PATCH /api/entry-exit/:id',
      'GET /api/entry-exit',
      'POST /api/breaks',
      'GET /api/breaks',
      'DELETE /api/breaks/:id'
    ]
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\nServidor activo en http://localhost:${PORT}`);
  console.log(`\nRutas disponibles:`);
  console.log(`- POST   /api/entry-exit`);
  console.log(`- PATCH  /api/entry-exit/:id`);
  console.log(`- GET    /api/entry-exit`);
  console.log(`- POST   /api/breaks`);
  console.log(`- GET    /api/breaks`);
  console.log(`- DELETE /api/breaks/:id`);
  console.log(`\nVerifica la conexión:`);
  console.log(`- GET    /api/healthcheck\n`);
});