const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----------------------
// AUTENTICAÇÃO (SIMPLES)
// ----------------------

// Registro
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    const query = `INSERT INTO users (name, email, password) VALUES (?, ?, ?)`;
    db.run(query, [name, email, password], function (err) {
        if (err) {
            if (err.message.includes('UNIQUE')) {
                return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, name, email });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    const query = `SELECT id, name, email FROM users WHERE email = ? AND password = ?`;
    db.get(query, [email, password], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!user) {
            return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
        }
        res.json({ user });
    });
});

// ----------------------
// DASHBOARD & MÉTRICAS
// ----------------------

app.get('/api/stats', (req, res) => {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'UserId é obrigatório.' });

    const todayStr = new Date().toISOString().split('T')[0];

    const queries = {
        total: `SELECT COUNT(*) as count FROM tasks WHERE user_id = ?`,
        completedToday: `SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status = 'Concluída' AND DATE(completed_at) = DATE('now', 'localtime')`,
        overdue: `SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status != 'Concluída' AND due_date < ?`,
        pending: `SELECT COUNT(*) as count FROM tasks WHERE user_id = ? AND status != 'Concluída'`
    };

    db.get(queries.total, [userId], (err, rowTotal) => {
        if (err) return res.status(500).json({ error: err.message });

        db.get(queries.completedToday, [userId], (err, rowToday) => {
            if (err) return res.status(500).json({ error: err.message });

            db.get(queries.overdue, [userId, todayStr], (err, rowOverdue) => {
                if (err) return res.status(500).json({ error: err.message });

                db.get(queries.pending, [userId], (err, rowPending) => {
                    if (err) return res.status(500).json({ error: err.message });

                    res.json({
                        total: rowTotal.count,
                        completedToday: rowToday.count,
                        overdue: rowOverdue.count,
                        pending: rowPending.count
                    });
                });
            });
        });
    });
});

// ----------------------
// CRUD DE TAREFAS
// ----------------------

// Listar Tarefas com Filtros
app.get('/api/tasks', (req, res) => {
    const userId = req.query.userId;
    const { status, priority, type, search } = req.query;

    if (!userId) return res.status(400).json({ error: 'UserId é obrigatório.' });

    let sql = `SELECT * FROM tasks WHERE user_id = ?`;
    let params = [userId];

    if (status && status !== 'Todos') {
        sql += ` AND status = ?`;
        params.push(status);
    }
    if (priority && priority !== 'Todas') {
        sql += ` AND priority = ?`;
        params.push(priority);
    }
    if (type && type !== 'Todos') {
        sql += ` AND type = ?`;
        params.push(type);
    }
    if (search) {
        sql += ` AND (title LIKE ? OR description LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY due_date ASC, priority DESC`;

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Criar Tarefa
app.post('/api/tasks', (req, res) => {
    const { user_id, title, description, due_date, type, priority, status } = req.body;

    if (!user_id || !title || !due_date) {
        return res.status(400).json({ error: 'Título, data de prazo e usuário são obrigatórios.' });
    }

    const taskStatus = status || 'Pendente';
    const completedAt = taskStatus === 'Concluída' ? new Date().toISOString() : null;

    const sql = `
        INSERT INTO tasks (user_id, title, description, due_date, type, priority, status, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.run(sql, [user_id, title, description || '', due_date, type || 'Trabalho', priority || 'Média', taskStatus, completedAt], function (err) {
        if (err) return res.status(500).json({ error: err.message });

        const taskId = this.lastID;

        // Registrar log inicial
        db.run(`INSERT INTO task_logs (task_id, old_status, new_status) VALUES (?, ?, ?)`, [taskId, null, taskStatus]);

        res.json({ id: taskId, message: 'Tarefa criada com sucesso.' });
    });
});

// Atualizar Tarefa (Status/Dados)
app.put('/api/tasks/:id', (req, res) => {
    const taskId = req.params.id;
    const { title, description, due_date, type, priority, status } = req.body;

    // Buscar tarefa existente para comparar status
    db.get(`SELECT status FROM tasks WHERE id = ?`, [taskId], (err, currentTask) => {
        if (err || !currentTask) return res.status(404).json({ error: 'Tarefa não encontrada.' });

        const oldStatus = currentTask.status;
        const newStatus = status || oldStatus;
        const completedAt = newStatus === 'Concluída' ? (oldStatus === 'Concluída' ? currentTask.completed_at : new Date().toISOString()) : null;

        const sql = `
            UPDATE tasks
            SET title = ?, description = ?, due_date = ?, type = ?, priority = ?, status = ?, completed_at = ?
            WHERE id = ?
        `;

        db.run(sql, [title, description, due_date, type, priority, newStatus, completedAt, taskId], function (err) {
            if (err) return res.status(500).json({ error: err.message });

            // Registrar Log se o status mudou
            if (oldStatus !== newStatus) {
                db.run(`INSERT INTO task_logs (task_id, old_status, new_status) VALUES (?, ?, ?)`, [taskId, oldStatus, newStatus]);
            }

            res.json({ message: 'Tarefa atualizada com sucesso.' });
        });
    });
});

// Deletar Tarefa
app.delete('/api/tasks/:id', (req, res) => {
    const taskId = req.params.id;

    db.run(`DELETE FROM tasks WHERE id = ?`, [taskId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Tarefa excluída.' });
    });
});

// Buscar Log de Status de uma Tarefa
app.get('/api/tasks/:id/logs', (req, res) => {
    const taskId = req.params.id;

    const sql = `SELECT * FROM task_logs WHERE task_id = ? ORDER BY changed_at DESC`;
    db.all(sql, [taskId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
