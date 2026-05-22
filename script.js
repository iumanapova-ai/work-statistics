// script.js
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== СОСТОЯНИЕ АВТОРИЗАЦИИ ==========
let isAuthenticated = false;
let currentUser = {
    name: '',
    email: ''
};

// ========== УПРАВЛЕНИЕ АВТОРИЗАЦИЕЙ (ЗАГЛУШКА) ==========
function updateAuthUI() {
    const unauthBlock = document.getElementById('unauthBlock');
    const authBlock = document.getElementById('authBlock');

    if (isAuthenticated && currentUser.name) {
        unauthBlock.style.display = 'none';
        authBlock.style.display = 'flex';
        document.getElementById('userName').textContent = currentUser.name;
    } else {
        unauthBlock.style.display = 'flex';
        authBlock.style.display = 'none';
    }
}

// Демо-вход
function demoLogin() {
    isAuthenticated = true;
    currentUser = {
        name: 'Демо Пользователь',
        email: 'demo@example.com'
    };
    updateAuthUI();
    showMessage('✅ Демо-вход выполнен', 'success');
    closeLoginModal();
}

function logout() {
    isAuthenticated = false;
    currentUser = { name: '', email: '' };
    updateAuthUI();
    showMessage('👋 Выход выполнен', 'success');
}

function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'flex';
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
    // Очищаем поля
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';
}

// ========== ОСТАЛЬНОЙ КОД (БЕЗ ИЗМЕНЕНИЙ) ==========
// ... (весь остальной код из предыдущей версии script.js)

// ========== ПЕРЕКЛЮЧЕНИЕ ГЛАВНЫХ ВКЛАДОК ==========
function switchMainTab(tabName) {
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    document.getElementById('tabAdd').style.display = tabName === 'add' ? 'block' : 'none';
    document.getElementById('tabHistory').style.display = tabName === 'history' ? 'block' : 'none';

    if (tabName === 'history') {
        loadHistoryData();
    }
}

// ========== ДАННЫЕ ДЛЯ ИСТОРИИ ==========
let historyRecords = [];
let filteredHistoryRecords = [];
let currentPage = 1;
let totalPages = 1;
const PAGE_SIZE = 25;
let isLoadingHistory = false;
let selectedIds = new Set();

let historyFilters = {
    dateFrom: '',
    dateTo: '',
    table: 'all',
    text: ''
};

// ========== РАБОТА С МЕРАМИ ==========
function addMeasureByType(type, containerId = 'measuresContainer') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const blockDiv = document.createElement('div');
    blockDiv.className = `measure-card measure-${type}`;

    let title = '', placeholder = '', inputType = 'text';
    switch(type) {
        case 'new-type': title = '🆕 Новый вид'; placeholder = 'Введите новый вид'; break;
        case 'new-solution': title = '💡 Новое решение'; placeholder = 'Введите новое решение'; break;
        case 'task': title = '🚀 Задача в разработку'; placeholder = 'Ссылка на задачу'; inputType = 'url'; break;
        case 'error': title = '⚠️ Ошибка'; placeholder = 'Ссылка на ошибку'; inputType = 'url'; break;
        default: return;
    }

    blockDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong>${title}</strong>
            <button type="button" class="remove-measure-btn" onclick="this.closest('.measure-card').remove()">✖️</button>
        </div>
        <input type="${inputType}" class="measure-value" placeholder="${placeholder}" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
    `;
    container.appendChild(blockDiv);
}

function collectMeasures(containerId = 'measuresContainer') {
    const measures = [];
    document.querySelectorAll(`#${containerId} .measure-card`).forEach(card => {
        const value = card.querySelector('.measure-value')?.value;
        if (!value || value.trim() === '') return;
        if (card.classList.contains('measure-new-type')) measures.push({ type: 'new_type', value: value.trim() });
        else if (card.classList.contains('measure-new-solution')) measures.push({ type: 'new_solution', value: value.trim() });
        else if (card.classList.contains('measure-task')) measures.push({ type: 'task', value: value.trim() });
        else if (card.classList.contains('measure-error')) measures.push({ type: 'error', value: value.trim() });
    });
    return measures;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getFullYear()).slice(2)}`;
}

function showMessage(text, type) {
    let msgDiv = document.getElementById('message');
    if (!msgDiv) return;
    msgDiv.textContent = text;
    msgDiv.className = `message ${type}`;
    msgDiv.style.display = 'block';
    setTimeout(() => { if (msgDiv) msgDiv.style.display = 'none'; }, 3000);
}

function showSpinner(show, spinnerId = 'loadingSpinner') {
    const spinner = document.getElementById(spinnerId);
    if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

function switchTab(tableName) {
    const consultationForm = document.getElementById('consultationForm');
    const dutyForm = document.getElementById('dutyRoomForm');
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.table === tableName) btn.classList.add('active');
        else btn.classList.remove('active');
    });
    if (tableName === 'Consultation_scenario') {
        consultationForm.style.display = 'block';
        dutyForm.style.display = 'none';
    } else {
        consultationForm.style.display = 'none';
        dutyForm.style.display = 'block';
    }
}

async function loadHistoryData() {
    if (isLoadingHistory) return;
    isLoadingHistory = true;
    showSpinner(true, 'historySpinner');

    try {
        const offset = (currentPage - 1) * PAGE_SIZE;

        const [consResponse, dutyResponse] = await Promise.all([
            sb.from('Consultation_scenario').select('*', { count: 'exact' }).range(offset, offset + PAGE_SIZE - 1).order('created_at', { ascending: false }),
            sb.from('duty_room').select('*', { count: 'exact' }).range(offset, offset + PAGE_SIZE - 1).order('created_at', { ascending: false })
        ]);

        const totalCons = consResponse.count || 0;
        const totalDuty = dutyResponse.count || 0;
        totalPages = Math.ceil((totalCons + totalDuty) / PAGE_SIZE);

        const newRecords = [];
        if (consResponse.data) {
            newRecords.push(...consResponse.data.map(r => ({
                id: r.id, source: 'consultation', sourceName: 'Сценарии консультаций',
                displayDate: r.created_at?.split('T')[0] || '', created_at: r.created_at,
                link: r.link || '', comment: r.comment || ''
            })));
        }
        if (dutyResponse.data) {
            newRecords.push(...dutyResponse.data.map(r => ({
                id: r.id, source: 'duty', sourceName: 'Дежурка',
                displayDate: r.period_from || '', created_at: r.created_at,
                period_from: r.period_from || '', period_to: r.period_to || '',
                period: r.period || '', quantity: r.quantity || 0, measures: r.measures || []
            })));
        }
        newRecords.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        historyRecords = newRecords;

        updatePageInfo();
        applyHistoryFilters();
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('Ошибка загрузки данных', 'error');
    } finally {
        showSpinner(false, 'historySpinner');
        isLoadingHistory = false;
    }
}

function updatePageInfo() {
    const pageText = `Страница ${currentPage} из ${totalPages || 1}`;
    const pageInfo = document.getElementById('pageInfo');
    const pageInfo2 = document.getElementById('pageInfo2');
    if (pageInfo) pageInfo.textContent = pageText;
    if (pageInfo2) pageInfo2.textContent = pageText;

    const prevBtn = document.getElementById('prevPageBtn');
    const prevBtn2 = document.getElementById('prevPageBtn2');
    const nextBtn = document.getElementById('nextPageBtn');
    const nextBtn2 = document.getElementById('nextPageBtn2');

    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (prevBtn2) prevBtn2.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
    if (nextBtn2) nextBtn2.disabled = currentPage >= totalPages;
}

function applyHistoryFilters() {
    let filtered = [...historyRecords];
    if (historyFilters.table !== 'all') filtered = filtered.filter(r => r.source === historyFilters.table);
    if (historyFilters.dateFrom) filtered = filtered.filter(r => r.displayDate >= historyFilters.dateFrom);
    if (historyFilters.dateTo) filtered = filtered.filter(r => r.displayDate <= historyFilters.dateTo);
    if (historyFilters.text) {
        const s = historyFilters.text.toLowerCase();
        filtered = filtered.filter(r => JSON.stringify(r).toLowerCase().includes(s));
    }
    filteredHistoryRecords = filtered;
    renderHistoryTable();
}

function renderHistoryTable() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    if (filteredHistoryRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет записей<\/td><\/tr>';
        return;
    }

    tbody.innerHTML = filteredHistoryRecords.map((record, index) => {
        let dataHtml = '';
        let sourceClass = record.source === 'consultation' ? 'source-consultation' : 'source-duty';
        let sourceText = record.source === 'consultation' ? '📋 Консультация' : '🚪 Дежурка';
        const isChecked = selectedIds.has(`${record.source}_${record.id}`);

        if (record.source === 'consultation') {
            dataHtml = `🔗 <a href="${record.link}" target="_blank">${record.link.length > 60 ? record.link.substring(0, 60) + '...' : record.link}</a><br>💬 ${record.comment || '—'}`;
        } else {
            let measuresHtml = '';
            if (record.measures?.length) {
                measuresHtml = '<ul style="margin: 5px 0 0 15px;">' + record.measures.map(m => {
                    switch(m.type) {
                        case 'new_type': return `<li>🆕 ${m.value}</li>`;
                        case 'new_solution': return `<li>💡 ${m.value}</li>`;
                        case 'task': return `<li>🚀 <a href="${m.value}" target="_blank">Задача</a></li>`;
                        case 'error': return `<li>⚠️ <a href="${m.value}" target="_blank">Ошибка</a></li>`;
                        default: return '';
                    }
                }).join('') + '</ul>';
            }
            const periodText = record.period_from ? `${formatDate(record.period_from)} — ${formatDate(record.period_to)}` : record.period;
            dataHtml = `📅 ${periodText}<br>🔢 ${record.quantity}<br>📋 ${measuresHtml || '—'}`;
        }

        return `
            <tr>
                <td><input type="checkbox" class="row-checkbox" data-source="${record.source}" data-id="${record.id}" ${isChecked ? 'checked' : ''}></td>
                <td>${index + 1}</td>
                <td><span class="source-badge ${sourceClass}">${sourceText}</span></td>
                <td>${dataHtml}</td>
                <td><button class="edit-btn" onclick="editRecord(${record.id}, '${record.source}')">✏️</button><button class="delete-btn" onclick="deleteRecord(${record.id}, '${record.source}')">🗑️</button></td>
            </tr>
        `;
    }).join('');

    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.onclick = (e) => {
            const source = cb.dataset.source;
            const id = parseInt(cb.dataset.id);
            const key = `${source}_${id}`;
            if (selectedIds.has(key)) selectedIds.delete(key);
            else selectedIds.add(key);
            updateSelectAllState();
        };
    });
    updateSelectAllState();
}

function updateSelectAllState() {
    const selectAll = document.getElementById('selectAllCheckbox');
    if (!selectAll) return;
    const allSelected = filteredHistoryRecords.length > 0 && filteredHistoryRecords.every(r => selectedIds.has(`${r.source}_${r.id}`));
    const someSelected = filteredHistoryRecords.some(r => selectedIds.has(`${r.source}_${r.id}`));
    selectAll.checked = allSelected;
    selectAll.indeterminate = someSelected && !allSelected;
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll.checked) filteredHistoryRecords.forEach(r => selectedIds.add(`${r.source}_${r.id}`));
    else filteredHistoryRecords.forEach(r => selectedIds.delete(`${r.source}_${r.id}`));
    renderHistoryTable();
}

async function addConsultation(link, comment) {
    const { error } = await sb.from('Consultation_scenario').insert([{ link, comment, created_at: new Date().toISOString() }]);
    if (error) { showMessage(`❌ ${error.message}`, 'error'); return; }
    showMessage('✅ Консультация добавлена!', 'success');
    document.getElementById('consultationLink').value = '';
    document.getElementById('consultationComment').value = '';
    if (document.getElementById('tabHistory').style.display === 'block') loadHistoryData();
}

async function addDutyRecord(periodFrom, periodTo, quantity, measures) {
    const { error } = await sb.from('duty_room').insert([{
        period_from: periodFrom, period_to: periodTo, period: `${periodFrom} — ${periodTo}`,
        quantity: parseInt(quantity), measures, created_at: new Date().toISOString()
    }]);
    if (error) { showMessage(`❌ ${error.message}`, 'error'); return; }
    showMessage('✅ Запись в дежурку добавлена!', 'success');
    document.getElementById('dutyPeriodFrom').value = '';
    document.getElementById('dutyPeriodTo').value = '';
    document.getElementById('dutyQuantity').value = '';
    document.getElementById('measuresContainer').innerHTML = '';
    if (document.getElementById('tabHistory').style.display === 'block') loadHistoryData();
}

window.deleteRecord = async (id, source) => {
    if (!confirm('Удалить запись?')) return;
    const table = source === 'consultation' ? 'Consultation_scenario' : 'duty_room';
    await sb.from(table).delete().eq('id', id);
    selectedIds.delete(`${source}_${id}`);
    showMessage('✅ Удалено', 'success');
    if (document.getElementById('tabHistory').style.display === 'block') loadHistoryData();
};

window.editRecord = async (id, source) => {
    const tableName = source === 'consultation' ? 'Consultation_scenario' : 'duty_room';
    const { data } = await sb.from(tableName).select('*').eq('id', id).single();
    const newVal = prompt('Новое значение (JSON для дежурки, ссылка для консультации)');
    if (!newVal) return;
    if (source === 'consultation') {
        await sb.from(tableName).update({ link: newVal }).eq('id', id);
    } else {
        try {
            const updates = JSON.parse(newVal);
            await sb.from(tableName).update(updates).eq('id', id);
        } catch(e) { showMessage('Ошибка JSON', 'error'); return; }
    }
    showMessage('✅ Обновлено', 'success');
    if (document.getElementById('tabHistory').style.display === 'block') loadHistoryData();
};

function exportSelected() {
    const records = filteredHistoryRecords.filter(r => selectedIds.has(`${r.source}_${r.id}`));
    if (!records.length) { showMessage('Ничего не выбрано', 'error'); return; }

    const consultationRecords = records.filter(r => r.source === 'consultation');
    const dutyRecords = records.filter(r => r.source === 'duty');
    const wb = XLSX.utils.book_new();

    const summaryData = [];
    if (dutyRecords.length) {
        summaryData.push(['ДЕЖУРКА'], ['Период', 'Количество', 'Новых видов', 'Новых решений', 'Задач', 'Ошибок']);
        dutyRecords.forEach(record => {
            const measures = record.measures || [];
            summaryData.push([`${formatDate(record.period_from)} — ${formatDate(record.period_to)}`, record.quantity || 0,
                measures.filter(m => m.type === 'new_type').length, measures.filter(m => m.type === 'new_solution').length,
                measures.filter(m => m.type === 'task').length, measures.filter(m => m.type === 'error').length]);
        });
        summaryData.push([]);
    }
    if (consultationRecords.length) {
        summaryData.push(['СЦЕНАРИИ КОНСУЛЬТАЦИЙ'], ['Дата', 'Ссылка', 'Комментарий']);
        consultationRecords.forEach(record => summaryData.push([formatDate(record.displayDate), record.link || '', record.comment || '']));
        summaryData.push([`ВСЕГО ЗАПИСЕЙ: ${consultationRecords.length}`]);
    }
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Сводный отчет');

    if (dutyRecords.length) {
        const dutyData = [['Период', 'Количество обращений']];
        let totalQty = 0;
        const allNewTypes = [], allNewSolutions = [], allTasks = [], allErrors = [];
        dutyRecords.forEach(record => {
            totalQty += record.quantity || 0;
            dutyData.push([`${formatDate(record.period_from)} — ${formatDate(record.period_to)}`, record.quantity || 0]);
            const measures = record.measures || [];
            allNewTypes.push(...measures.filter(m => m.type === 'new_type').map(m => m.value));
            allNewSolutions.push(...measures.filter(m => m.type === 'new_solution').map(m => m.value));
            allTasks.push(...measures.filter(m => m.type === 'task').map(m => m.value));
            allErrors.push(...measures.filter(m => m.type === 'error').map(m => m.value));
        });
        dutyData.push(['ИТОГО:', totalQty], [], ['Меры'], ['Новый вид', 'Новое решение', 'Задача', 'Ошибка']);
        const maxRows = Math.max(allNewTypes.length, allNewSolutions.length, allTasks.length, allErrors.length);
        for (let i = 0; i < maxRows; i++) dutyData.push([allNewTypes[i] || '', allNewSolutions[i] || '', allTasks[i] || '', allErrors[i] || '']);
        dutyData.push(['ИТОГО ПО МЕРАМ:', allNewTypes.length, allNewSolutions.length, allTasks.length, allErrors.length]);
        const ws2 = XLSX.utils.aoa_to_sheet(dutyData);
        XLSX.utils.book_append_sheet(wb, ws2, 'Дежурка');
    }

    if (consultationRecords.length) {
        const consData = [['Дата', 'Ссылка', 'Комментарий']];
        consultationRecords.forEach(record => consData.push([formatDate(record.displayDate), record.link || '', record.comment || '']));
        consData.push([`ВСЕГО ЗАПИСЕЙ: ${consultationRecords.length}`]);
        const ws3 = XLSX.utils.aoa_to_sheet(consData);
        XLSX.utils.book_append_sheet(wb, ws3, 'Консультации');
    }

    XLSX.writeFile(wb, `export_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.xlsx`);
    showMessage(`✅ Экспортировано ${records.length} записей`, 'success');
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    // Авторизация (заглушка)
    document.getElementById('loginBtn')?.addEventListener('click', openLoginModal);
    document.getElementById('demoLoginBtn')?.addEventListener('click', demoLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('closeLoginModal')?.addEventListener('click', closeLoginModal);

    // Закрытие модалки по клику вне
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('loginModal');
        if (e.target === modal) closeLoginModal();
    });

    // Главные вкладки
    document.querySelectorAll('.main-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchMainTab(btn.dataset.tab));
    });

    // Подвкладки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.table));
    });

    // Меры
    document.getElementById('addNewTypeBtn')?.addEventListener('click', () => addMeasureByType('new-type'));
    document.getElementById('addNewSolutionBtn')?.addEventListener('click', () => addMeasureByType('new-solution'));
    document.getElementById('addTaskBtn')?.addEventListener('click', () => addMeasureByType('task'));
    document.getElementById('addErrorBtn')?.addEventListener('click', () => addMeasureByType('error'));

    // Добавление
    document.getElementById('addConsultationBtn')?.addEventListener('click', async () => {
        const link = document.getElementById('consultationLink').value.trim();
        if (!link) { showMessage('Введите ссылку', 'error'); return; }
        await addConsultation(link, document.getElementById('consultationComment').value);
    });

    document.getElementById('addDutyBtn')?.addEventListener('click', async () => {
        const from = document.getElementById('dutyPeriodFrom').value;
        const to = document.getElementById('dutyPeriodTo').value;
        const qty = document.getElementById('dutyQuantity').value;
        if (!from || !to || !qty) { showMessage('Заполните поля', 'error'); return; }
        await addDutyRecord(from, to, qty, collectMeasures());
    });

    // Фильтры истории
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');
    const filterTable = document.getElementById('filterTable');
    const filterText = document.getElementById('filterText');
    const clearBtn = document.getElementById('clearFiltersBtn');

    function updateHistoryFilters() {
        historyFilters = {
            dateFrom: filterDateFrom?.value || '',
            dateTo: filterDateTo?.value || '',
            table: filterTable?.value || 'all',
            text: filterText?.value || ''
        };
        applyHistoryFilters();
    }

    filterDateFrom?.addEventListener('change', updateHistoryFilters);
    filterDateTo?.addEventListener('change', updateHistoryFilters);
    filterTable?.addEventListener('change', updateHistoryFilters);
    filterText?.addEventListener('input', updateHistoryFilters);
    clearBtn?.addEventListener('click', () => {
        if (filterDateFrom) filterDateFrom.value = '';
        if (filterDateTo) filterDateTo.value = '';
        if (filterTable) filterTable.value = 'all';
        if (filterText) filterText.value = '';
        updateHistoryFilters();
    });

    document.getElementById('exportSelectedBtn')?.addEventListener('click', exportSelected);
    document.getElementById('selectAllCheckbox')?.addEventListener('change', toggleSelectAll);

    // Пагинация
    document.getElementById('prevPageBtn')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadHistoryData(); } });
    document.getElementById('nextPageBtn')?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; loadHistoryData(); } });
    document.getElementById('prevPageBtn2')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadHistoryData(); } });
    document.getElementById('nextPageBtn2')?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; loadHistoryData(); } });

    updateAuthUI();
    switchMainTab('add');
});