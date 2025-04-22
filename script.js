// ==============================================
// CONFIGURACIÓN BASE - URLs dinámicas
// ==============================================
const IS_DEVELOPMENT = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const API_BASE_URL = window.location.hostname === 'knoza.onrender.com' 
  ? 'https://knoza.onrender.com/api' 
  : 'http://localhost:3001/api';

const FETCH_OPTIONS = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json'
  }
};

// Datos de usuarios válidos
const users = [
    { id: "234", password: "1244", name: "Nicolas", lastName: "Canosa", isAdmin: false },
    { id: "239", password: "1234", name: "Ayrton", lastName: "Roldan", isAdmin: false },
    { id: "232", password: "1111", name: "Matias", lastName: "Vichi", isAdmin: false },
    { id: "ADMIN", password: "1244", name: "Administrador", lastName: "", isAdmin: true }
];

// Variables globales
let currentUser = null;
let breakInterval = null;
let breakStartTime = null;
let selectedBreakMinutes = 0;
let breakActive = false;

// Elementos del DOM
const loginContainer = document.getElementById('login-container');
const dashboard = document.getElementById('dashboard');
const loginForm = document.getElementById('login-form');
const employeeIdInput = document.getElementById('employee-id');
const passwordInput = document.getElementById('password');
const welcomeMessage = document.getElementById('welcome-message');
const logoutBtn = document.getElementById('logout-btn');

// Opciones del menú
const entryExitOption = document.getElementById('entry-exit-option');
const breakOption = document.getElementById('break-option');
const priceOption = document.getElementById('price-option');

// Secciones de contenido
const entryExitSection = document.getElementById('entry-exit-section');
const breakSection = document.getElementById('break-section');
const priceSection = document.getElementById('price-section');

// Elementos de Entrada/Salida
const registerEntryBtn = document.getElementById('register-entry');
const registerExitBtn = document.getElementById('register-exit');
const entryExitTableBody = document.getElementById('entry-exit-table-body');
const entryExitSearch = document.getElementById('entry-exit-search');
const copyEntryExitBtn = document.getElementById('copy-entry-exit');
const entryExitHistory = document.getElementById('entry-exit-history');

// Elementos de Descanso
const startBreakBtn = document.getElementById('start-break');
const endBreakBtn = document.getElementById('end-break');
const timerDisplay = document.getElementById('timer-display');
const breakTypeInput = document.getElementById('break-type');
const breakButtons = document.querySelectorAll('.btn-break-option');
const breakTableBody = document.getElementById('break-table-body');
const breakSearch = document.getElementById('break-search');
const copyBreakBtn = document.getElementById('copy-break');
const breakHistory = document.getElementById('break-history');

// Elementos de Simulador de Precios
const medicineNameInput = document.getElementById('medicine-name');
const grossPriceInput = document.getElementById('gross-price');
const coverageInput = document.getElementById('coverage');
const calculatePriceBtn = document.getElementById('calculate-price');
const priceTableBody = document.getElementById('price-table-body');
const clearPriceTableBtn = document.getElementById('clear-price-table');

// Modales
const modal = document.getElementById('message-modal');
const modalMessage = document.getElementById('modal-message');
const closeModal = document.querySelector('.close-modal');
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmYes = document.getElementById('confirm-yes');
const confirmNo = document.getElementById('confirm-no');
let currentRecordToDelete = null;
let currentDeleteFunction = null;

// ==============================================
// FUNCIONES PRINCIPALES
// ==============================================

async function fetchData(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('Sending request to:', url); // ← Esto aparecerá en la consola del navegador
    
    try {
        const response = await fetch(url, {
            ...FETCH_OPTIONS,
            ...options
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Full error details:', {
            url,
            error: error.message,
            stack: error.stack
        });
        showMessage(`Error al conectar: ${error.message}`);
        throw error;
    }
}

// Manejo de login
function handleLogin(e) {
    e.preventDefault();
    const employeeId = employeeIdInput.value.trim();
    const password = passwordInput.value.trim();
    const user = users.find(u => u.id === employeeId && u.password === password);
    
    if (user) {
        currentUser = user;
        showDashboard();
    } else {
        showMessage('Credenciales incorrectas');
    }
}

// Manejo de logout
function handleLogout() {
    currentUser = null;
    showLogin();
    resetBreakControls();
}

// Mostrar dashboard
function showDashboard() {
    loginContainer.classList.add('hidden');
    dashboard.classList.remove('hidden');
    welcomeMessage.textContent = `Bienvenido, ${currentUser.name}${currentUser.isAdmin ? ' (Admin)' : ''}`;
    
    // Mostrar/ocultar secciones de admin
    entryExitHistory.classList.toggle('hidden', !currentUser.isAdmin);
    breakHistory.classList.toggle('hidden', !currentUser.isAdmin);
    
    showSection('entry-exit');
}

// Mostrar login
function showLogin() {
    loginContainer.classList.remove('hidden');
    dashboard.classList.add('hidden');
    loginForm.reset();
}

// Mostrar sección específica
function showSection(section) {
    entryExitSection.classList.add('hidden');
    breakSection.classList.add('hidden');
    priceSection.classList.add('hidden');

    switch(section) {
        case 'entry-exit':
            entryExitSection.classList.remove('hidden');
            if (currentUser.isAdmin) renderEntryExitTable();
            break;
        case 'break':
            breakSection.classList.remove('hidden');
            updateBreakType();
            if (currentUser.isAdmin) renderBreakTable();
            break;
        case 'price':
            priceSection.classList.remove('hidden');
            break;
    }
}

// ==============================================
// FUNCIONES DE ENTRADA/SALIDA
// ==============================================

// Registrar entrada
async function registerEntry() {
    const now = new Date();
    const record = {
        employee_id: currentUser.id,
        date: now.toISOString().split('T')[0],
        entry_time: now.toTimeString().slice(0, 8),
        exit_time: null,
        timestamp: now.getTime()
    };

    try {
        // Verificar si ya tiene una entrada sin salida
const existingRecords = await fetchData(`/entry-exit?employee_id=${currentUser.id}&date=${record.date}`);
        const hasOpenEntry = existingRecords.some(r => r.exit_time === null);

        if (hasOpenEntry) {
            showMessage('Ya tienes una entrada registrada hoy');
            return;
        }

        // Guardar nueva entrada
        await fetchData('/entry-exit', {
            method: 'POST',
            body: JSON.stringify(record)
        });

        showMessage('Entrada registrada');
        if (currentUser.isAdmin) await renderEntryExitTable();
    } catch (error) {
        console.error('Error al registrar entrada:', error);
    }
}

// Registrar salida
async function registerExit() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const exitTime = now.toTimeString().slice(0, 8);

    try {
        // Obtener el registro de entrada sin salida
        const records = await fetchData(`/entry-exit?employee_id=${currentUser.id}&date=${date}`);
        const openEntry = records.find(r => r.exit_time === null);

        if (!openEntry) {
            showMessage('No tienes entrada registrada hoy');
            return;
        }

        // Actualizar con la hora de salida
        await fetchData(`/entry-exit/${openEntry.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ exit_time: exitTime })
        });

        showMessage('Salida registrada');
        if (currentUser.isAdmin) await renderEntryExitTable();
    } catch (error) {
        console.error('Error al registrar salida:', error);
    }
}

// Mostrar tabla de entradas/salidas
async function renderEntryExitTable() {
    try {
        const records = await fetchData('/entry-exit');
        entryExitTableBody.innerHTML = '';

        records.forEach(record => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${record.employee_id}</td>
                <td>${record.date}</td>
                <td>${record.entry_time || '-'}</td>
                <td>${record.exit_time || '-'}</td>
                <td>${currentUser.isAdmin ? 
                    `<button class="btn-delete" data-id="${record.id}">Eliminar</button>` : 
                    '-'}
                </td>
            `;
            entryExitTableBody.appendChild(row);
        });

        // Agregar event listeners a los botones de eliminar
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => prepareDeleteEntryExit(btn));
        });
    } catch (error) {
        console.error('Error al cargar registros:', error);
    }
}

// Preparar eliminación de registro
function prepareDeleteEntryExit(button) {
    if (!currentUser.isAdmin) return;
    
    const recordId = button.getAttribute('data-id');
    
    currentDeleteFunction = async () => {
        try {
            await fetchData(`/entry-exit/${recordId}`, {
                method: 'DELETE'
            });
            await renderEntryExitTable();
            showMessage('Registro eliminado');
        } catch (error) {
            console.error('Error al eliminar registro:', error);
        }
    };
    
    showDeleteConfirmation();
}

// ==============================================
// FUNCIONES DE DESCANSO
// ==============================================

// Seleccionar duración de descanso
function selectBreakDuration(e) {
    selectedBreakMinutes = parseInt(e.target.getAttribute('data-minutes'));
    breakButtons.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
}

// Iniciar descanso
async function startBreak() {
    if (selectedBreakMinutes === 0) {
        showMessage('Selecciona la duración de tu descanso');
        return;
    }
    
    if (breakActive) {
        showMessage('Descanso en curso');
        return;
    }
    
    // Verificar límite diario de descansos
    try {
        const today = new Date().toISOString().split('T')[0];
        const breaks = await fetchData(`/breaks?employee_id=${currentUser.id}&date=${today}`);
        const totalMinutes = breaks.reduce((sum, b) => sum + parseInt(b.duration), 0);
        
        if (totalMinutes >= 30) {
            showMessage('Límite diario alcanzado (30 min)');
            return;
        }
    } catch (error) {
        console.error('Error al verificar descansos:', error);
        return;
    }
    
    breakActive = true;
    breakStartTime = new Date();
    startBreakBtn.disabled = true;
    endBreakBtn.disabled = false;
    updateBreakType();
    breakInterval = setInterval(updateBreakTimer, 1000);
}

// Actualizar temporizador de descanso
function updateBreakTimer() {
    const elapsed = Math.floor((new Date() - breakStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    
    if (mins >= 25) {
        endBreak();
        return;
    }
    
    timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Finalizar descanso
async function endBreak() {
    if (!breakActive) return;
    
    clearInterval(breakInterval);
    const duration = Math.floor((new Date() - breakStartTime) / 60000);
    
    const record = {
        employee_id: currentUser.id,
        date: breakStartTime.toISOString().split('T')[0],
        break_type: breakTypeInput.value,
        duration: `${duration} min`,
        timestamp: breakStartTime.getTime()
    };

    try {
        await fetchData('/breaks', {
            method: 'POST',
            body: JSON.stringify(record)
        });

        showMessage(`Descanso registrado: ${duration} minutos`);
        if (currentUser.isAdmin) await renderBreakTable();
    } catch (error) {
        console.error('Error al registrar descanso:', error);
    }
    
    resetBreakControls();
}

// Reiniciar controles de descanso
function resetBreakControls() {
    clearInterval(breakInterval);
    timerDisplay.textContent = '00:00';
    breakActive = false;
    breakStartTime = null;
    selectedBreakMinutes = 0;
    breakButtons.forEach(btn => btn.classList.remove('active'));
    startBreakBtn.disabled = false;
    endBreakBtn.disabled = true;
}

// Actualizar tipo de descanso según hora
function updateBreakType() {
    const hours = new Date().getHours();
    breakTypeInput.value = 
        hours >= 8 && hours < 12 ? 'Desayuno' :
        hours >= 12 && hours < 16 ? 'Almuerzo' :
        hours >= 16 && hours < 20 ? 'Merienda' : 'Fuera de horario';
}

// Mostrar tabla de descansos
async function renderBreakTable() {
    try {
        const breaks = await fetchData('/breaks');
        breakTableBody.innerHTML = '';

        breaks.forEach(record => {
            const row = document.createElement('tr');
            const tiempoReal = parseInt(record.duration);
            const excedido = record.break_option && tiempoReal > parseInt(record.break_option);
            
            if (excedido) row.classList.add('exceeded-time');
            
            row.innerHTML = `
                <td>${record.employee_id}</td>
                <td>${record.date}</td>
                <td>${record.break_type}</td>
                <td>${record.break_option || '-'}</td>
                <td>${record.duration}</td>
                <td>${currentUser.isAdmin ? 
                    `<button class="btn-delete" data-id="${record.id}">Eliminar</button>` : 
                    '-'}
                </td>
            `;
            breakTableBody.appendChild(row);
        });

        // Agregar event listeners a los botones de eliminar
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => prepareDeleteBreak(btn));
        });
    } catch (error) {
        console.error('Error al cargar descansos:', error);
    }
}

// Preparar eliminación de registro de descanso
function prepareDeleteBreak(button) {
    if (!currentUser.isAdmin) return;
    
    const breakId = button.getAttribute('data-id');
    
    currentDeleteFunction = async () => {
        try {
            await fetchData(`/breaks/${breakId}`, {
                method: 'DELETE'
            });
            await renderBreakTable();
            showMessage('Registro de descanso eliminado');
        } catch (error) {
            console.error('Error al eliminar descanso:', error);
        }
    };
    
    showDeleteConfirmation();
}

// ==============================================
// FUNCIONES DE SIMULADOR DE PRECIOS
// ==============================================

// Calcular precio
function calculatePrice() {
    const medicineName = medicineNameInput.value.trim();
    const grossPrice = parseFloat(grossPriceInput.value);
    const coverage = parseInt(coverageInput.value);
    
    if (!medicineName || isNaN(grossPrice) || isNaN(coverage)) {
        showMessage('Complete todos los campos');
        return;
    }
    
    const finalPrice = grossPrice * (1 - coverage / 100);
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${medicineName}</td>
        <td>${formatCurrency(grossPrice)}</td>
        <td>${coverage}%</td>
        <td>${formatCurrency(finalPrice)}</td>
    `;
    priceTableBody.prepend(row);
    
    medicineNameInput.value = '';
    grossPriceInput.value = '';
    coverageInput.value = '';
    updateGrandTotal();
}

// Actualizar total general
function updateGrandTotal() {
    const prices = Array.from(priceTableBody.querySelectorAll('tr td:nth-child(4)'))
        .map(td => {
            const text = td.textContent.replace(/[^0-9.-]/g, '');
            return parseFloat(text) || 0;
        });
    
    const total = prices.reduce((sum, price) => sum + price, 0);
    document.getElementById('grand-total').textContent = formatCurrency(total);
}

// Limpiar tabla de precios
function clearPriceTable() {
    if (priceTableBody.children.length === 0) {
        showMessage('La tabla está vacía');
        return;
    }
    
    confirmMessage.textContent = '¿Estás seguro que deseas limpiar la tabla de precios?';
    currentDeleteFunction = () => {
        priceTableBody.innerHTML = '';
        document.getElementById('grand-total').textContent = '$0.00';
        showMessage('Tabla de precios limpia');
    };
    showDeleteConfirmation();
}

// ==============================================
// FUNCIONES DE FILTRADO
// ==============================================

// Filtrar tabla de entradas/salidas
function filterEntryExitTable() {
    const searchTerm = entryExitSearch.value.toLowerCase();
    entryExitTableBody.querySelectorAll('tr').forEach(row => {
        row.style.display = row.cells[0].textContent.includes(searchTerm) ? '' : 'none';
    });
}

// Filtrar tabla de descansos
function filterBreakTable() {
    const searchTerm = breakSearch.value.toLowerCase();
    breakTableBody.querySelectorAll('tr').forEach(row => {
        row.style.display = row.cells[0].textContent.includes(searchTerm) ? '' : 'none';
    });
}

// ==============================================
// FUNCIONES DE MODALES
// ==============================================

// Mostrar confirmación de eliminación
function showDeleteConfirmation() {
    confirmModal.classList.remove('hidden');
}

// Confirmar eliminación
function confirmDelete() {
    if (currentDeleteFunction) {
        currentDeleteFunction();
    }
    confirmModal.classList.add('hidden');
}

// Cancelar eliminación
function cancelDelete() {
    confirmModal.classList.add('hidden');
    currentRecordToDelete = null;
    currentDeleteFunction = null;
}

// Mostrar mensaje
function showMessage(msg) {
    modalMessage.textContent = msg;
    modal.classList.remove('hidden');
}

// Cerrar modal de mensaje
function closeMessageModal() {
    modal.classList.add('hidden');
}

// ==============================================
// FUNCIONES DE UTILIDAD
// ==============================================

// Copiar tabla al portapapeles
function copyTableToClipboard(tableId) {
    try {
        const table = document.getElementById(tableId);
        if (!table) {
            showMessage('Tabla no encontrada');
            return;
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) {
            showMessage('No hay datos para copiar');
            return;
        }

        let csvContent = "";
        const rows = tbody.querySelectorAll('tr:not([style*="display: none"])');

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            let rowData = [];
            
            if (tableId === 'entry-exit-table') {
                for (let i = 0; i < 4 && i < cells.length; i++) {
                    rowData.push(cells[i].textContent.trim());
                }
            } else if (tableId === 'break-table') {
                for (let i = 0; i < 5 && i < cells.length; i++) {
                    rowData.push(cells[i].textContent.trim());
                }
            }
            
            csvContent += rowData.join('\t') + '\n';
        });

        if (csvContent) {
            navigator.clipboard.writeText(csvContent)
                .then(() => showMessage('Datos copiados'))
                .catch(() => {
                    const textarea = document.createElement('textarea');
                    textarea.value = csvContent;
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    showMessage('Historial copiado');
                });
        } else {
            showMessage('No hay datos visibles para copiar');
        }
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error al copiar los datos');
    }
}

// Formatear fecha
function formatDate(date) {
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Formatear hora
function formatTime(date) {
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

// Formatear moneda
function formatCurrency(amount) {
    return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ==============================================
// INICIALIZACIÓN
// ==============================================

document.addEventListener('DOMContentLoaded', () => {
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    
    entryExitOption.addEventListener('click', () => showSection('entry-exit'));
    breakOption.addEventListener('click', () => showSection('break'));
    priceOption.addEventListener('click', () => showSection('price'));
    
    registerEntryBtn.addEventListener('click', registerEntry);
    registerExitBtn.addEventListener('click', registerExit);
    entryExitSearch.addEventListener('input', filterEntryExitTable);
    copyEntryExitBtn.addEventListener('click', () => {
        if (!currentUser.isAdmin) {
            showMessage('Acceso restringido: Solo administradores');
            return;
        }
        copyTableToClipboard('entry-exit-table');
    });
    
    startBreakBtn.addEventListener('click', startBreak);
    endBreakBtn.addEventListener('click', endBreak);
    breakButtons.forEach(btn => btn.addEventListener('click', selectBreakDuration));
    breakSearch.addEventListener('input', filterBreakTable);
    copyBreakBtn.addEventListener('click', () => {
        if (!currentUser.isAdmin) {
            showMessage('Acceso restringido: Solo administradores');
            return;
        }
        copyTableToClipboard('break-table');
    });
    
    calculatePriceBtn.addEventListener('click', calculatePrice);
    clearPriceTableBtn.addEventListener('click', clearPriceTable);
    
    // Eventos para modales
    closeModal.addEventListener('click', closeMessageModal);
    modal.addEventListener('click', (e) => e.target === modal && closeMessageModal());
    confirmYes.addEventListener('click', confirmDelete);
    confirmNo.addEventListener('click', cancelDelete);
    confirmModal.addEventListener('click', (e) => e.target === confirmModal && cancelDelete());
});