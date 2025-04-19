const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 1. CONEXIÓN A MySQL
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'knoza_db'
});

// Conectar a MySQL
db.connect((err) => {
  if (err) {
    console.error('❌ Error al conectar a MySQL:', err);
  } else {
    console.log('✅ Conectado a MySQL');
  }
});

// 2. RUTAS PARA ENTRADAS/SALIDAS
// Guardar registro de entrada
app.post('/api/entry-exit', (req, res) => {
  const { employee_id, date, entry_time, exit_time, timestamp } = req.body;
  const query = `
    INSERT INTO entry_exit (employee_id, date, entry_time, exit_time, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.query(query, [employee_id, date, entry_time, exit_time, timestamp], (err, result) => {
    if (err) {
      console.error('Error al guardar entrada/salida:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
    res.json({ success: true, message: 'Registro guardado', id: result.insertId });
  });
});

// Actualizar registro de salida (NUEVA RUTA)
app.patch('/api/entry-exit/:id', (req, res) => {
  const { exit_time } = req.body;
  const query = 'UPDATE entry_exit SET exit_time = ? WHERE id = ?';
  
  db.query(query, [exit_time, req.params.id], (err, result) => {
    if (err) {
      console.error('Error al actualizar salida:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json({ success: true, message: 'Salida registrada' });
  });
});

// Obtener todos los registros
app.get('/api/entry-exit', (req, res) => {
  const { employee_id, date } = req.query;
  let query = 'SELECT * FROM entry_exit';
  let params = [];

  if (employee_id && date) {
    query += ' WHERE employee_id = ? AND date = ?';
    params = [employee_id, date];
  }

  query += ' ORDER BY date DESC, entry_time DESC';

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error al leer registros:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
    res.json(results);
  });
});

// 3. RUTAS PARA DESCANSOs
// Guardar descanso
app.post('/api/breaks', (req, res) => {
  const { employee_id, date, break_type, duration, timestamp } = req.body;
  const query = `
    INSERT INTO breaks (employee_id, date, break_type, duration, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `;
  
  db.query(query, [employee_id, date, break_type, duration, timestamp], (err, result) => {
    if (err) {
      console.error('Error al guardar descanso:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
    res.json({ success: true, message: 'Descanso registrado' });
  });
});

// Obtener todos los descansos
app.get('/api/breaks', (req, res) => {
  const { employee_id, date } = req.query;
  let query = 'SELECT * FROM breaks';
  let params = [];

  if (employee_id && date) {
    query += ' WHERE employee_id = ? AND date = ?';
    params = [employee_id, date];
  }

  query += ' ORDER BY date DESC, timestamp DESC';

  db.query(query, params, (err, results) => {
    if (err) {
      console.error('Error al leer descansos:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
    res.json(results);
  });
});

// Eliminar registro (para admin)
app.delete('/api/entry-exit/:id', (req, res) => {
  const query = 'DELETE FROM entry_exit WHERE id = ?';
  
  db.query(query, [req.params.id], (err, result) => {
    if (err) {
      console.error('Error al eliminar registro:', err);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json({ success: true, message: 'Registro eliminado' });
  });
});

// 4. RUTA DE PRUEBA
app.get('/', (req, res) => {
  res.send('Backend de KnoZa funcionando correctamente 🚀');
});

// 5. INICIAR SERVIDOR
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor activo en http://localhost:${PORT}`);
});