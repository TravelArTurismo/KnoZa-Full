// Datos de usuarios válidos (se mantienen igual)
const users = [
    { id: "234", password: "1244", name: "Nicolas", lastName: "Canosa", isAdmin: false },
    { id: "239", password: "1234", name: "Ayrton", lastName: "Roldan", isAdmin: false },
    { id: "232", password: "1111", name: "Matias", lastName: "Vichi", isAdmin: false },
    { id: "ADMIN", password: "1244", name: "Administrador", lastName: "", isAdmin: true }
];

// Variables globales (se mantienen igual)
let currentUser = null;
let breakInterval = null;
let breakStartTime = null;
let selectedBreakMinutes = 0;
let breakActive = false;

// Elementos del DOM (se mantienen igual)
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
// FUNCIONES MODIFICADAS PARA USAR EL BACKEND API
// ==============================================

// Función para hacer fetch con manejo de errores
async function fetchData(url, options = {}) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`Error ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        showMessage('Error de conexión con el servidor');
        throw error;
    }
}

// Registro de entrada
async function registerEntry() {
    const now = new Date();
    const record = {
        employee_id: currentUser.id,
        date: now.toISOString().split('T')[0], // Formato YYYY-MM-DD
        entry_time: now.toTimeString().slice(0, 8), // Formato HH:MM:SS
        exit_time: null,
        timestamp: now.getTime()
    };

    try {
        // Verificar si ya tiene una entrada sin salida
        const existingRecords = await fetchData(`http://localhost:3001/api/entry-exit?employee_id=${currentUser.id}&date=${record.date}`);
        const hasOpenEntry = existingRecords.some(r => r.exit_time === null);

        if (hasOpenEntry) {
            showMessage('Ya tienes una entrada registrada hoy');
            return;
        }

        // Guardar nueva entrada
        await fetchData('http://localhost:3001/api/entry-exit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });

        showMessage('Entrada registrada');
        if (currentUser.isAdmin) await renderEntryExitTable();
    } catch (error) {
        console.error('Error al registrar entrada:', error);
    }
}

// Registro de salida
async function registerExit() {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const exitTime = now.toTimeString().slice(0, 8);

    try {
        // Obtener el registro de entrada sin salida
        const records = await fetchData(`http://localhost:3001/api/entry-exit?employee_id=${currentUser.id}&date=${date}`);
        const openEntry = records.find(r => r.exit_time === null);

        if (!openEntry) {
            showMessage('No tienes entrada registrada hoy');
            return;
        }

        // Actualizar con la hora de salida
        await fetchData(`http://localhost:3001/api/entry-exit/${openEntry.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ exit_time: exitTime })
        });

        showMessage('Salida registrada');
        if (currentUser.isAdmin) await renderEntryExitTable();
    } catch (error) {
        console.error('Error al registrar salida:', error);
    }
}

// Renderizar tabla de entradas/salidas
async function renderEntryExitTable() {
    try {
        const records = await fetchData('http://localhost:3001/api/entry-exit');
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

// Preparar eliminación de registro de entrada/salida
function prepareDeleteEntryExit(button) {
    if (!currentUser.isAdmin) return;
    
    const recordId = button.getAttribute('data-id');
    
    currentDeleteFunction = async () => {
        try {
            await fetchData(`http://localhost:3001/api/entry-exit/${recordId}`, {
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
        const breaks = await fetchData(`http://localhost:3001/api/breaks?employee_id=${currentUser.id}&date=${today}`);
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
        await fetchData('http://localhost:3001/api/breaks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
        });

        showMessage(`Descanso registrado: ${duration} minutos`);
        if (currentUser.isAdmin) await renderBreakTable();
    } catch (error) {
        console.error('Error al registrar descanso:', error);
    }
    
    resetBreakControls();
}

// Renderizar tabla de descansos
async function renderBreakTable() {
    try {
        const breaks = await fetchData('http://localhost:3001/api/breaks');
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
            await fetchData(`http://localhost:3001/api/breaks/${breakId}`, {
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
// FUNCIONES QUE SE MANTIENEN IGUAL
// ==============================================

// Inicialización (se mantiene igual excepto por loadData)
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

// Funciones principales que no cambian
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

function handleLogout() {
    currentUser = null;
    showLogin();
    resetBreakControls();
}

function showDashboard() {
    loginContainer.classList.add('hidden');
    dashboard.classList.remove('hidden');
    welcomeMessage.textContent = `Bienvenido, ${currentUser.name}${currentUser.isAdmin ? '' : ''}`;
    
    // Mostrar/ocultar secciones de admin
    entryExitHistory.classList.toggle('hidden', !currentUser.isAdmin);
    breakHistory.classList.toggle('hidden', !currentUser.isAdmin);
    
    showSection('entry-exit');
}

function showLogin() {
    loginContainer.classList.remove('hidden');
    dashboard.classList.add('hidden');
    loginForm.reset();
}

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

// Funciones de Descanso que no cambian
function selectBreakDuration(e) {
    selectedBreakMinutes = parseInt(e.target.getAttribute('data-minutes'));
    breakButtons.forEach(btn => btn.classList.remove('active'));
    e.target.classList.add('active');
}

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

function updateBreakType() {
    const hours = new Date().getHours();
    breakTypeInput.value = 
        hours >= 8 && hours < 12 ? 'Desayuno' :
        hours >= 12 && hours < 16 ? 'Almuerzo' :
        hours >= 16 && hours < 20 ? 'Merienda' : 'Fuera de horario';
}

// Funciones de filtrado que no cambian
function filterEntryExitTable() {
    const searchTerm = entryExitSearch.value.toLowerCase();
    entryExitTableBody.querySelectorAll('tr').forEach(row => {
        row.style.display = row.cells[0].textContent.includes(searchTerm) ? '' : 'none';
    });
}

function filterBreakTable() {
    const searchTerm = breakSearch.value.toLowerCase();
    breakTableBody.querySelectorAll('tr').forEach(row => {
        row.style.display = row.cells[0].textContent.includes(searchTerm) ? '' : 'none';
    });
}

// Funciones de Simulador de Precios que no cambian
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

function updateGrandTotal() {
    const prices = Array.from(priceTableBody.querySelectorAll('tr td:nth-child(4)'))
        .map(td => {
            const text = td.textContent.replace(/[^0-9.-]/g, '');
            return parseFloat(text) || 0;
        });
    
    const total = prices.reduce((sum, price) => sum + price, 0);
    document.getElementById('grand-total').textContent = formatCurrency(total);
}

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

// Funciones para modales que no cambian
function showDeleteConfirmation() {
    confirmModal.classList.remove('hidden');
}

function confirmDelete() {
    if (currentDeleteFunction) {
        currentDeleteFunction();
    }
    confirmModal.classList.add('hidden');
}

function cancelDelete() {
    confirmModal.classList.add('hidden');
    currentRecordToDelete = null;
    currentDeleteFunction = null;
}

// Funciones de utilidad que no cambian
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

function formatDate(date) {
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(date) {
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(amount) {
    return '$' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function showMessage(msg) {
    modalMessage.textContent = msg;
    modal.classList.remove('hidden');
}

function closeMessageModal() {
    modal.classList.add('hidden');
}
