document.addEventListener('DOMContentLoaded', () => {
    // ------------------------------------------------------------------
    // ESTADO E ELEMENTOS DA APLICAÇÃO
    // ------------------------------------------------------------------
    const authSection = document.getElementById('auth-section');
    const appSection = document.getElementById('app-section');
    
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegisterBtn = document.getElementById('show-register');
    const showLoginBtn = document.getElementById('show-login');
    const logoutBtn = document.getElementById('logout-btn');
    
    const userGreeting = document.getElementById('user-greeting');
    const tasksContainer = document.getElementById('tasks-container');
    
    // Filtros & Busca
    const searchInput = document.getElementById('search-input');
    const filterStatus = document.getElementById('filter-status');
    const filterPriority = document.getElementById('filter-priority');
    const filterType = document.getElementById('filter-type');
    
    // Modais
    const taskModal = document.getElementById('task-modal');
    const taskForm = document.getElementById('task-form');
    const openNewTaskBtn = document.getElementById('open-new-task-modal');
    const modalTitle = document.getElementById('modal-title');
    
    const logsModal = document.getElementById('logs-modal');
    const logsContainer = document.getElementById('logs-container');
    
    let currentUser = JSON.parse(localStorage.getItem('taskmaster_user')) || null;

    // Inicialização
    if (currentUser) {
        showApp();
    } else {
        showAuth();
    }

    // ------------------------------------------------------------------
    // AUTENTICAÇÃO (LOGIN / REGISTRO / LOGOUT)
    // ------------------------------------------------------------------
    showRegisterBtn.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
    });

    showLoginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            currentUser = data.user;
            localStorage.setItem('taskmaster_user', JSON.stringify(currentUser));
            showApp();
        } catch (err) {
            alert(err.message || 'Erro ao conectar com o servidor. Verifique se o backend está rodando.');
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const email = document.getElementById('reg-email').value;
        const password = document.getElementById('reg-password').value;

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            currentUser = { id: data.id, name: data.name, email: data.email };
            localStorage.setItem('taskmaster_user', JSON.stringify(currentUser));
            showApp();
        } catch (err) {
            alert(err.message || 'Erro ao conectar com o servidor. Verifique se o backend está rodando.');
        }
    });

    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('taskmaster_user');
        currentUser = null;
        showAuth();
    });

    function showAuth() {
        authSection.classList.remove('hidden');
        appSection.classList.add('hidden');
    }

    function showApp() {
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        userGreeting.textContent = `Olá, ${currentUser.name}`;
        loadDashboardData();
    }

    // ------------------------------------------------------------------
    // CARREGAMENTO DO DASHBOARD (MÉTRICAS & TAREFAS)
    // ------------------------------------------------------------------
    async function loadDashboardData() {
        if (!currentUser) return;
        await fetchStats();
        await fetchTasks();
    }

    async function fetchStats() {
        try {
            const res = await fetch(`/api/stats?userId=${currentUser.id}`);
            const stats = await res.json();
            
            document.getElementById('stat-total').textContent = stats.total || 0;
            document.getElementById('stat-today').textContent = stats.completedToday || 0;
            document.getElementById('stat-overdue').textContent = stats.overdue || 0;
            document.getElementById('stat-pending').textContent = stats.pending || 0;
        } catch (err) {
            console.error('Erro ao buscar estatísticas:', err);
        }
    }

    async function fetchTasks() {
        try {
            const search = searchInput.value;
            const status = filterStatus.value;
            const priority = filterPriority.value;
            const type = filterType.value;

            const url = `/api/tasks?userId=${currentUser.id}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}&priority=${encodeURIComponent(priority)}&type=${encodeURIComponent(type)}`;
            const res = await fetch(url);
            const tasks = await res.json();

            renderTasks(tasks);
        } catch (err) {
            console.error('Erro ao carregar tarefas:', err);
        }
    }

    function renderTasks(tasks) {
        tasksContainer.innerHTML = '';

        if (tasks.length === 0) {
            tasksContainer.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
                    <i class="fa-regular fa-folder-open" style="font-size: 2.5rem; margin-bottom: 10px;"></i>
                    <p>Nenhuma tarefa encontrada.</p>
                </div>
            `;
            return;
        }

        const todayStr = new Date().toISOString().split('T')[0];

        tasks.forEach(task => {
            const isCompleted = task.status === 'Concluída';
            const isOverdue = !isCompleted && task.due_date < todayStr;

            let cardBorderClass = '';
            if (isCompleted) cardBorderClass = 'completed-border';
            else if (isOverdue) cardBorderClass = 'overdue-border';

            const badgePriorityClass = task.priority === 'Alta' ? 'badge-high' : (task.priority === 'Baixa' ? 'badge-low' : 'badge-medium');

            const formattedDate = new Date(task.due_date + 'T00:00:00').toLocaleDateString('pt-BR');

            const cardHtml = `
                <div class="task-card ${cardBorderClass}">
                    <div>
                        <div class="task-header">
                            <h4 class="task-title">${escapeHtml(task.title)}</h4>
                            <div class="task-actions">
                                <button class="icon-btn view-logs-btn" data-id="${task.id}" title="Ver logs de status">
                                    <i class="fa-solid fa-history"></i>
                                </button>
                                <button class="icon-btn edit-task-btn" data-id="${task.id}" title="Editar">
                                    <i class="fa-solid fa-pen-to-square"></i>
                                </button>
                                <button class="icon-btn delete-task-btn" data-id="${task.id}" title="Excluir">
                                    <i class="fa-solid fa-trash" style="color: var(--accent-red);"></i>
                                </button>
                            </div>
                        </div>
                        <p class="task-desc">${escapeHtml(task.description || 'Sem descrição.')}</p>
                        <div class="task-badges">
                            <span class="badge ${badgePriorityClass}">${task.priority}</span>
                            <span class="badge badge-type">${task.type}</span>
                            <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-secondary);">${task.status}</span>
                        </div>
                    </div>
                    <div class="task-footer">
                        <span><i class="fa-regular fa-calendar"></i> ${formattedDate} ${isOverdue ? '<strong style="color: var(--accent-red);">(Atrasada)</strong>' : ''}</span>
                        <div>
                            ${!isCompleted ? `
                                <button class="btn btn-secondary complete-btn" data-id="${task.id}" style="padding: 4px 10px; font-size: 0.8rem;">
                                    <i class="fa-solid fa-check"></i> Concluir
                                </button>
                            ` : '<span style="color: var(--accent-green);"><i class="fa-solid fa-check-double"></i> Feito</span>'}
                        </div>
                    </div>
                </div>
            `;

            tasksContainer.insertAdjacentHTML('beforeend', cardHtml);
        });

        // Eventos nos cards criados
        document.querySelectorAll('.edit-task-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id, tasks));
        });

        document.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteTask(btn.dataset.id));
        });

        document.querySelectorAll('.complete-btn').forEach(btn => {
            btn.addEventListener('click', () => completeTask(btn.dataset.id, tasks));
        });

        document.querySelectorAll('.view-logs-btn').forEach(btn => {
            btn.addEventListener('click', () => openLogsModal(btn.dataset.id));
        });
    }

    // ------------------------------------------------------------------
    // FILTROS & BUSCA (EVENTOS)
    // ------------------------------------------------------------------
    searchInput.addEventListener('input', fetchTasks);
    filterStatus.addEventListener('change', fetchTasks);
    filterPriority.addEventListener('change', fetchTasks);
    filterType.addEventListener('change', fetchTasks);

    // ------------------------------------------------------------------
    // MODAL DE CRIAR/EDITAR TAREFA
    // ------------------------------------------------------------------
    openNewTaskBtn.addEventListener('click', () => {
        taskForm.reset();
        document.getElementById('task-id').value = '';
        document.getElementById('task-due-date').value = new Date().toISOString().split('T')[0];
        modalTitle.textContent = 'Nova Tarefa';
        taskModal.classList.remove('hidden');
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => taskModal.classList.add('hidden'));
    });

    function openEditModal(id, tasks) {
        const task = tasks.find(t => t.id == id);
        if (!task) return;

        document.getElementById('task-id').value = task.id;
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-desc').value = task.description || '';
        document.getElementById('task-due-date').value = task.due_date;
        document.getElementById('task-type').value = task.type;
        document.getElementById('task-priority').value = task.priority;
        document.getElementById('task-status').value = task.status;

        modalTitle.textContent = 'Editar Tarefa';
        taskModal.classList.remove('hidden');
    }

    taskForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('task-id').value;
        const payload = {
            user_id: currentUser.id,
            title: document.getElementById('task-title').value,
            description: document.getElementById('task-desc').value,
            due_date: document.getElementById('task-due-date').value,
            type: document.getElementById('task-type').value,
            priority: document.getElementById('task-priority').value,
            status: document.getElementById('task-status').value
        };

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/tasks/${id}` : '/api/tasks';

        try {
            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error);
            }

            taskModal.classList.add('hidden');
            loadDashboardData();
        } catch (err) {
            alert('Erro ao salvar tarefa: ' + err.message);
        }
    });

    async function completeTask(id, tasks) {
        const task = tasks.find(t => t.id == id);
        if (!task) return;

        const payload = {
            ...task,
            status: 'Concluída'
        };

        try {
            const res = await fetch(`/api/tasks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) loadDashboardData();
        } catch (err) {
            console.error(err);
        }
    }

    async function deleteTask(id) {
        if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;

        try {
            const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
            if (res.ok) loadDashboardData();
        } catch (err) {
            console.error(err);
        }
    }

    // ------------------------------------------------------------------
    // MODAL DE LOGS DE STATUS
    // ------------------------------------------------------------------
    async function openLogsModal(id) {
        logsContainer.innerHTML = '<li>Carregando histórico...</li>';
        logsModal.classList.remove('hidden');

        try {
            const res = await fetch(`/api/tasks/${id}/logs`);
            const logs = await res.json();

            logsContainer.innerHTML = '';
            if (logs.length === 0) {
                logsContainer.innerHTML = '<li class="log-item">Nenhuma alteração registrada.</li>';
                return;
            }

            logs.forEach(log => {
                const dateStr = new Date(log.changed_at).toLocaleString('pt-BR');
                const transition = log.old_status ? `${log.old_status} ➔ ${log.new_status}` : `Criado como "${log.new_status}"`;
                
                logsContainer.insertAdjacentHTML('beforeend', `
                    <li class="log-item">
                        <span><strong>${transition}</strong></span>
                        <span style="color: var(--text-muted);">${dateStr}</span>
                    </li>
                `);
            });
        } catch (err) {
            logsContainer.innerHTML = '<li class="log-item" style="color: red;">Erro ao carregar histórico.</li>';
        }
    }

    document.querySelectorAll('.close-logs-modal').forEach(btn => {
        btn.addEventListener('click', () => logsModal.classList.add('hidden'));
    });

    // Utilitário Escapar HTML
    function escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
