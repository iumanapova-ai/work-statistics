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
        enableAdminActions(currentUser.role === 'admin');
    } else {
        unauthBlock.style.display = 'flex';
        authBlock.style.display = 'none';
        enableAdminActions(false);
    }
}

function demoLogin() {
    isAuthenticated = true;
    currentUser = {
        name: 'Демо Пользователь',
        email: 'demo@example.com',
        role: 'admin'
    };

    // Сохраняем в localStorage
    localStorage.setItem('workstats_auth', JSON.stringify({
        authenticated: true,
        user: currentUser,
        expires: Date.now() + 86400000 // 24 часа
    }));

    updateAuthUI();
    showMessage('✅ Демо-вход выполнен', 'success');
    closeLoginModal();

    // Обновляем права на кнопках
    enableAdminActions(true);
}

function logout() {
    isAuthenticated = false;
    currentUser = { name: '', email: '', role: 'viewer' };

    // Удаляем из localStorage
    localStorage.removeItem('workstats_auth');

    updateAuthUI();
    showMessage('👋 Выход выполнен', 'success');

    // Блокируем кнопки
    enableAdminActions(false);

    // Обновляем таблицу (показываем без кнопок редактирования)
    if (typeof loadHistoryData === 'function') loadHistoryData();
}

function checkSavedAuth() {
    const saved = localStorage.getItem('workstats_auth');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            if (data.expires > Date.now() && data.authenticated) {
                isAuthenticated = true;
                currentUser = data.user;
                updateAuthUI();
                enableAdminActions(true);
                console.log('✅ Авторизация восстановлена из localStorage');
                return true;
            } else {
                localStorage.removeItem('workstats_auth');
            }
        } catch(e) {
            localStorage.removeItem('workstats_auth');
        }
    }

    // Если нет сохранённой авторизации — блокируем кнопки
    enableAdminActions(false);
    return false;
}

function enableAdminActions(enable) {
    const editBtns = document.querySelectorAll('.edit-btn');
    const deleteBtns = document.querySelectorAll('.delete-btn');
    const addConsultationBtn = document.getElementById('addConsultationBtn');
    const addDutyBtn = document.getElementById('addDutyBtn');
    const addAppealBtn = document.getElementById('addAppealBtn');

    editBtns.forEach(btn => { if (btn) btn.disabled = !enable; });
    deleteBtns.forEach(btn => { if (btn) btn.disabled = !enable; });
    if (addConsultationBtn) addConsultationBtn.disabled = !enable;
    if (addDutyBtn) addDutyBtn.disabled = !enable;
    if (addAppealBtn) addAppealBtn.disabled = !enable;
}

function openLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'flex';
}

function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) modal.style.display = 'none';
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';
}

// ========== ЛОГГИРОВАНИЕ ДЕЙСТВИЙ ==========
function logAction(action, details = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        action,
        user: isAuthenticated ? currentUser.email : 'anonymous',
        details
    };
    console.log('📝 [LOG]', JSON.stringify(logEntry, null, 2));
    const logs = JSON.parse(localStorage.getItem('action_logs') || '[]');
    logs.push(logEntry);
    if (logs.length > 100) logs.shift();
    localStorage.setItem('action_logs', JSON.stringify(logs));
}

// ========== ПЕРЕКЛЮЧЕНИЕ ГЛАВНЫХ ВКЛАДОК ==========
function switchMainTab(tabName) {
    logAction('switch_tab', { tab: tabName });

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
    const appealsForm = document.getElementById('appealsForm');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.table === tableName) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    consultationForm.style.display = tableName === 'Consultation_scenario' ? 'block' : 'none';
    dutyForm.style.display = tableName === 'duty_room' ? 'block' : 'none';
    if (appealsForm) appealsForm.style.display = tableName === 'appeals' ? 'block' : 'none';
}

function addAppealMeasure(type) {
    const container = document.getElementById('appealMeasuresContainer');
    if (!container) return;

    const blockDiv = document.createElement('div');
    blockDiv.className = `measure-card measure-${type}`;

    let title = '', placeholder = '', inputType = 'text';
    switch(type) {
        case 'new-type': title = '🆕 Новый вид'; placeholder = 'Введите новый вид'; break;
        case 'new-solution': title = '💡 Новое решение'; placeholder = 'Введите новое решение'; break;
        case 'task': title = '🚀 Задача в разработку'; placeholder = 'Ссылка на задачу'; inputType = 'url'; break;
        case 'error': title = '⚠️ Ошибка'; placeholder = 'Ссылка на ошибку'; inputType = 'url'; break;
        case 'help': title = '📚 Изменение документации HELP'; placeholder = 'Описание изменения'; break;
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

function collectAppealMeasures() {
    const measures = [];
    document.querySelectorAll('#appealMeasuresContainer .measure-card').forEach(card => {
        const value = card.querySelector('.measure-value')?.value;
        if (!value || value.trim() === '') return;

        if (card.classList.contains('measure-new-type')) measures.push({ type: 'new_type', value: value.trim() });
        else if (card.classList.contains('measure-new-solution')) measures.push({ type: 'new_solution', value: value.trim() });
        else if (card.classList.contains('measure-task')) measures.push({ type: 'task', value: value.trim() });
        else if (card.classList.contains('measure-error')) measures.push({ type: 'error', value: value.trim() });
        else if (card.classList.contains('measure-help')) measures.push({ type: 'help', value: value.trim() });
    });
    return measures;
}

async function addAppeal(link, comment, measures) {
    console.log('=== addAppeal вызвана ===');
    console.log('Ссылка:', link);

    if (!isAuthenticated) {
        showMessage('Требуется авторизация', 'error');
        return;
    }

    if (!link || link.trim() === '') {
        showMessage('Введите ссылку', 'error');
        return;
    }

    // Проверка на дубли (работает и с 0, и с 1, и с несколькими строками)
    const { data: existing, error: checkError } = await sb
        .from('appeals')
        .select('id')
        .eq('link', link.trim());

    if (checkError) {
        console.error('Ошибка проверки дубля:', checkError);
        showMessage(`Ошибка проверки: ${checkError.message}`, 'error');
        return;
    }

    if (existing && existing.length > 0) {
        showMessage(`❌ Ошибка: ссылка "${link}" уже существует`, 'error');
        return;
    }

    console.log('Дублей нет, добавляю...');
    const { error: insertError } = await sb.from('appeals').insert([{
        link: link.trim(),
        comment: comment || null,
        measures: measures || [],
        created_at: new Date().toISOString()
    }]);

    if (insertError) {
        console.error('Ошибка вставки:', insertError);
        showMessage(`❌ Ошибка добавления: ${insertError.message}`, 'error');
        return;
    }

    showMessage('✅ Обращение добавлено', 'success');

    // Очищаем форму
    document.getElementById('appealLink').value = '';
    document.getElementById('appealComment').value = '';
    document.getElementById('appealMeasuresContainer').innerHTML = '';

    // Обновляем историю
    if (typeof loadHistoryData === 'function') loadHistoryData();
}


async function loadHistoryData() {
    if (isLoadingHistory) return;
    isLoadingHistory = true;
    showSpinner(true, 'historySpinner');

    logAction('load_history', { page: currentPage, filters: historyFilters });

    try {
        const offset = (currentPage - 1) * PAGE_SIZE;

        const [consResponse, dutyResponse, appealsResponse] = await Promise.all([
            sb.from('Consultation_scenario').select('*', { count: 'exact' }).range(offset, offset + PAGE_SIZE - 1).order('created_at', { ascending: false }),
            sb.from('duty_room').select('*', { count: 'exact' }).range(offset, offset + PAGE_SIZE - 1).order('created_at', { ascending: false }),
            sb.from('appeals').select('*', { count: 'exact' }).range(offset, offset + PAGE_SIZE - 1).order('created_at', { ascending: false })
        ]);

        const totalCons = consResponse.count || 0;
        const totalDuty = dutyResponse.count || 0;
        const totalAppeals = appealsResponse.count || 0;
        totalPages = Math.ceil((totalCons + totalDuty + totalAppeals) / PAGE_SIZE);

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
                period: r.period || '', quantity: r.quantity || 0, measures: r.measures || [],
                duty_type: r.duty_type || '', source_links: r.source_links || []
            })));
        }
        if (appealsResponse.data) {
            newRecords.push(...appealsResponse.data.map(r => ({
                id: r.id, source: 'appeal', sourceName: 'Обращение',
                displayDate: r.created_at?.split('T')[0] || '', created_at: r.created_at,
                link: r.link || '', comment: r.comment || '', measures: r.measures || []
            })));
        }
        newRecords.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        historyRecords = newRecords;

        updatePageInfo();
        applyHistoryFilters();

        logAction('history_loaded', { count: historyRecords.length, totalPages });
    } catch (error) {
        console.error('Ошибка:', error);
        logAction('history_error', { error: error.message });
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
        let sourceClass = '';
        let sourceText = '';
        const isChecked = selectedIds.has(`${record.source}_${record.id}`);

        // ========== КОНСУЛЬТАЦИИ ==========
        if (record.source === 'consultation') {
            sourceClass = 'source-consultation';
            sourceText = '📋 Консультация';
            dataHtml = `🔗 <a href="${record.link}" target="_blank">${record.link.length > 60 ? record.link.substring(0, 60) + '...' : record.link}</a><br>💬 ${record.comment || '—'}`;
        }
        // ========== ДЕЖУРКА ==========
        else if (record.source === 'duty') {
            sourceClass = 'source-duty';
            sourceText = '🚪 Дежурка';

            let measuresHtml = '';
            if (record.measures?.length) {
                measuresHtml = '<ul style="margin: 5px 0 0 15px;">' + record.measures.map(m => {
                    switch(m.type) {
                        case 'new_type': return `<li>Новый вид: ${m.value}</li>`;
                        case 'new_solution': return `<li>Новое решение: ${m.value}</li>`;
                        case 'task': return `<li><a href="${m.value}" target="_blank">Задача в разработку</a></li>`;
                        case 'error': return `<li><a href="${m.value}" target="_blank">Ошибка</a></li>`;
                        default: return '';
                    }
                }).join('') + '</ul>';
            }
            const periodText = record.period_from ? `${formatDate(record.period_from)} — ${formatDate(record.period_to)}` : record.period;
            dataHtml = `📅 Период: ${periodText}<br>🔢 Количество: ${record.quantity}<br>📋 Меры: ${measuresHtml || '—'}`;
        }
        // ========== ОБРАЩЕНИЯ ==========
        else if (record.source === 'appeal') {
            sourceClass = 'source-appeal';
            sourceText = '📞 Обращение';

            let measuresHtml = '';
            if (record.measures?.length) {
                measuresHtml = '<ul style="margin: 5px 0 0 15px;">' + record.measures.map(m => {
                    switch(m.type) {
                        case 'new_type': return `<li>Новый вид: ${m.value}</li>`;
                        case 'new_solution': return `<li>Новое решение: ${m.value}</li>`;
                        case 'task': return `<li><a href="${m.value}" target="_blank">Задача</a></li>`;
                        case 'error': return `<li><a href="${m.value}" target="_blank">Ошибка</a></li>`;
                        case 'help': return `<li>📚 HELP: ${m.value}</li>`;
                        default: return '';
                    }
                }).join('') + '</ul>';
            }
            dataHtml = `🔗 <a href="${record.link}" target="_blank">${record.link.length > 60 ? record.link.substring(0, 60) + '...' : record.link}</a><br>💬 ${record.comment || '—'}<br>📋 Меры: ${measuresHtml || '—'}`;
        }

        const actions = (isAuthenticated && currentUser.role === 'admin')
            ? `<button class="edit-btn" onclick="editRecord(${record.id}, '${record.source}')">✏️</button>
               <button class="delete-btn" onclick="deleteRecord(${record.id}, '${record.source}')">🗑️</button>`
            : `<span style="color:#999;">🔒</span>`;

        return `
            <tr>
                <td style="text-align: center;"><input type="checkbox" class="row-checkbox" data-source="${record.source}" data-id="${record.id}" ${isChecked ? 'checked' : ''}></td>
                <td>${index + 1}</td>
                <td><span class="source-badge ${sourceClass}">${sourceText}</span></td>
                <td>${dataHtml}</td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');

    // Перепривязываем события чекбоксов
    document.querySelectorAll('.row-checkbox').forEach(cb => {
        cb.onclick = () => {
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
    if (!isAuthenticated) {
        showMessage('Требуется авторизация', 'error');
        return;
    }

    // Проверка на дубли по ссылке
    const { data: existing, error: checkError } = await sb
        .from('Consultation_scenario')
        .select('id')
        .eq('link', link)
        .maybeSingle();

    if (existing) {
        showMessage('❌ Такая ссылка уже существует!', 'error');
        return;
    }

    const { error } = await sb.from('Consultation_scenario').insert([{
        link,
        comment: comment || null,
        created_at: new Date().toISOString()
    }]);

    if (error) {
        showMessage(`❌ ${error.message}`, 'error');
        return;
    }

    showMessage('✅ Консультация добавлена', 'success');
    document.getElementById('consultationLink').value = '';
    document.getElementById('consultationComment').value = '';
    if (currentType === 'consultation') loadHistoryData();
}

async function addDutyRecord(periodFrom, periodTo, quantity, measures) {
    logAction('add_duty', { periodFrom, periodTo, quantity, measures });

    const { error } = await sb.from('duty_room').insert([{
        period_from: periodFrom, period_to: periodTo, period: `${periodFrom} — ${periodTo}`,
        quantity: parseInt(quantity), measures, created_at: new Date().toISOString()
    }]);
    if (error) {
        logAction('add_duty_error', { error: error.message });
        showMessage(`❌ ${error.message}`, 'error');
        return;
    }
        // Проверка на дубли по периоду
    const { data: existing, error: checkError } = await sb
        .from('duty_room')
        .select('id')
        .eq('period_from', periodFrom)
        .eq('period_to', periodTo)
        .maybeSingle();

    if (existing) {
        showMessage('❌ Такой период уже существует!', 'error');
        return;
    }
    showMessage('✅ Запись в дежурку добавлена!', 'success');
    document.getElementById('dutyPeriodFrom').value = '';
    document.getElementById('dutyPeriodTo').value = '';
    document.getElementById('dutyQuantity').value = '';
    document.getElementById('measuresContainer').innerHTML = '';
    if (document.getElementById('tabHistory').style.display === 'block') loadHistoryData();
}

window.deleteRecord = async (id, source) => {
    console.log('=== deleteRecord вызван ===', id, source);

    if (!confirm('Удалить запись?')) return;

    let table;
    if (source === 'consultation') table = 'Consultation_scenario';
    else if (source === 'duty') table = 'duty_room';
    else if (source === 'appeal') table = 'appeals';
    else {
        showMessage('Неизвестный источник', 'error');
        return;
    }

    console.log('Удаляем из таблицы:', table, 'id:', id);

    const { data, error } = await sb.from(table).delete().eq('id', id).select();

    if (error) {
        console.error('Ошибка удаления:', error);
        showMessage(`❌ Ошибка: ${error.message}`, 'error');
        return;
    }

    console.log('Результат удаления:', data);

    if (data && data.length > 0) {
        selectedIds.delete(`${source}_${id}`);
        showMessage('✅ Запись удалена', 'success');
    } else {
        showMessage('❌ Запись не найдена или не удалена', 'error');
        return;
    }

    // Обновляем историю
    if (typeof loadHistoryData === 'function') loadHistoryData();
};

// ========== КРАСИВОЕ РЕДАКТИРОВАНИЕ (С КРЕСТИКОМ) ==========
function openEditConsultationModal(id, data) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; width: 500px; max-width: 90%; position: relative;">
            <button class="modal-close" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">✖️</button>
            <h3 style="margin-bottom: 20px;">✏️ Редактировать консультацию #${id}</h3>
            <div class="form-group">
                <label>🔗 Ссылка</label>
                <input type="url" id="editLink" value="${data.link || ''}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
            </div>
            <div class="form-group">
                <label>💬 Комментарий</label>
                <textarea id="editComment" rows="3" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">${data.comment || ''}</textarea>
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end;">
                <button id="cancelEditBtn" class="btn btn-secondary">❌ Отмена</button>
                <button id="saveEditBtn" class="btn btn-primary">💾 Сохранить</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.modal-close').onclick = () => modal.remove();

    document.getElementById('saveEditBtn').onclick = async () => {
        const updates = {
            link: document.getElementById('editLink').value,
            comment: document.getElementById('editComment').value || null
        };
        logAction('edit_consultation', { id, updates });

        const { error } = await sb.from('Consultation_scenario').update(updates).eq('id', id);
        if (error) {
            showMessage(`❌ ${error.message}`, 'error');
        } else {
            showMessage('✅ Консультация обновлена', 'success');
        }
        modal.remove();
        if (document.getElementById('tabHistory').style.display === 'block') loadHistoryData();
    };

    document.getElementById('cancelEditBtn').onclick = () => modal.remove();
}

function openEditDutyModal(id, data) {
    let measuresHtml = '';
    if (data.measures && data.measures.length > 0) {
        measuresHtml = data.measures.map((m, idx) => {
            let typeClass = '', title = '';
            switch(m.type) {
                case 'new_type': typeClass = 'new-type'; title = '🆕 Новый вид'; break;
                case 'new_solution': typeClass = 'new-solution'; title = '💡 Новое решение'; break;
                case 'task': typeClass = 'task'; title = '🚀 Задача'; break;
                case 'error': typeClass = 'error'; title = '⚠️ Ошибка'; break;
            }
            return `
                <div class="measure-card measure-${typeClass}" style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #e0e0e0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong>${title}</strong>
                        <button type="button" class="remove-measure-btn" style="background: #dc3545; color: white; border: none; border-radius: 5px; padding: 4px 8px; cursor: pointer;" onclick="this.closest('.measure-card').remove()">✖️</button>
                    </div>
                    <input type="${m.type === 'task' || m.type === 'error' ? 'url' : 'text'}" class="measure-value" value="${(m.value || '').replace(/"/g, '&quot;')}" placeholder="Введите значение" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
                </div>
            `;
        }).join('');
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; width: 600px; max-width: 90%; max-height: 80vh; overflow-y: auto; position: relative;">
            <button class="modal-close" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">✖️</button>
            <h3 style="margin-bottom: 20px;">✏️ Редактировать дежурку #${id}</h3>

            <div class="form-group">
                <label>📅 Период (от)</label>
                <input type="date" id="editPeriodFrom" value="${data.period_from || ''}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
            </div>

            <div class="form-group">
                <label>📅 Период (до)</label>
                <input type="date" id="editPeriodTo" value="${data.period_to || ''}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
            </div>

            <div class="form-group">
                <label>🔢 Количество</label>
                <input type="number" id="editQuantity" value="${data.quantity || ''}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
            </div>

            <div class="form-group">
                <label>📋 Меры</label>
                <div id="editMeasuresContainer">
                    ${measuresHtml || '<div style="color: #999; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">Нет мер. Добавьте ниже.</div>'}
                </div>
                <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-small" id="addNewTypeEditBtn" style="background: #17a2b8; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;">➕ Новый вид</button>
                    <button type="button" class="btn btn-small" id="addNewSolutionEditBtn" style="background: #17a2b8; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;">➕ Новое решение</button>
                    <button type="button" class="btn btn-small" id="addTaskEditBtn" style="background: #17a2b8; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;">➕ Задача</button>
                    <button type="button" class="btn btn-small" id="addErrorEditBtn" style="background: #17a2b8; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;">➕ Ошибка</button>
                </div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: flex-end;">
                <button id="cancelEditBtn" class="btn btn-secondary">❌ Отмена</button>
                <button id="saveEditBtn" class="btn btn-primary">💾 Сохранить</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.modal-close').onclick = () => modal.remove();

    const addMeasureToModal = (type) => {
        const container = document.getElementById('editMeasuresContainer');
        if (!container) return;
        if (container.innerHTML.includes('Нет мер')) container.innerHTML = '';

        let title = '', placeholder = '', inputType = 'text';
        switch(type) {
            case 'new-type': title = '🆕 Новый вид'; placeholder = 'Введите новый вид'; break;
            case 'new-solution': title = '💡 Новое решение'; placeholder = 'Введите новое решение'; break;
            case 'task': title = '🚀 Задача'; placeholder = 'Ссылка на задачу'; inputType = 'url'; break;
            case 'error': title = '⚠️ Ошибка'; placeholder = 'Ссылка на ошибку'; inputType = 'url'; break;
        }

        const blockDiv = document.createElement('div');
        blockDiv.className = `measure-card measure-${type}`;
        blockDiv.style.cssText = 'background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #e0e0e0;';
        blockDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>${title}</strong>
                <button type="button" class="remove-measure-btn" style="background: #dc3545; color: white; border: none; border-radius: 5px; padding: 4px 8px; cursor: pointer;" onclick="this.closest('.measure-card').remove()">✖️</button>
            </div>
            <input type="${inputType}" class="measure-value" placeholder="${placeholder}" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
        `;
        container.appendChild(blockDiv);
    };

    document.getElementById('addNewTypeEditBtn')?.addEventListener('click', () => addMeasureToModal('new-type'));
    document.getElementById('addNewSolutionEditBtn')?.addEventListener('click', () => addMeasureToModal('new-solution'));
    document.getElementById('addTaskEditBtn')?.addEventListener('click', () => addMeasureToModal('task'));
    document.getElementById('addErrorEditBtn')?.addEventListener('click', () => addMeasureToModal('error'));

    document.getElementById('saveEditBtn').onclick = async () => {
        const measures = [];
        document.querySelectorAll('#editMeasuresContainer .measure-card').forEach(card => {
            const value = card.querySelector('.measure-value')?.value;
            if (!value || value.trim() === '') return;
            if (card.classList.contains('measure-new-type')) measures.push({ type: 'new_type', value: value.trim() });
            else if (card.classList.contains('measure-new-solution')) measures.push({ type: 'new_solution', value: value.trim() });
            else if (card.classList.contains('measure-task')) measures.push({ type: 'task', value: value.trim() });
            else if (card.classList.contains('measure-error')) measures.push({ type: 'error', value: value.trim() });
        });

        const updates = {
            period_from: document.getElementById('editPeriodFrom').value,
            period_to: document.getElementById('editPeriodTo').value,
            quantity: parseInt(document.getElementById('editQuantity').value),
            measures: measures
        };
        updates.period = `${updates.period_from} — ${updates.period_to}`;

        logAction('edit_duty', { id, updates });

        const { error } = await sb.from('duty_room').update(updates).eq('id', id);
        if (error) {
            showMessage(`❌ ${error.message}`, 'error');
        } else {
            showMessage('✅ Дежурка обновлена', 'success');
        }
        modal.remove();
        if (document.getElementById('tabHistory').style.display === 'block') loadHistoryData();
    };

    document.getElementById('cancelEditBtn').onclick = () => modal.remove();
}

window.editRecord = async (id, source) => {
    logAction('edit_record_start', { id, source });

    let tableName;
    if (source === 'consultation') tableName = 'Consultation_scenario';
    else if (source === 'duty') tableName = 'duty_room';
    else if (source === 'appeal') tableName = 'appeals';
    else return;

    const { data, error } = await sb.from(tableName).select('*').eq('id', id).single();
    if (error) {
        showMessage('Ошибка загрузки записи', 'error');
        return;
    }

    const oldModal = document.querySelector('.modal');
    if (oldModal) oldModal.remove();

    if (source === 'duty') {
        openEditDutyModal(id, data);
    } else if (source === 'consultation') {
        openEditConsultationModal(id, data);
    } else if (source === 'appeal') {
        openEditAppealModal(id, data);
    }
};

// ========== ЭКСПОРТ В EXCEL ==========
function exportSelected() {
    const records = filteredHistoryRecords.filter(r => selectedIds.has(`${r.source}_${r.id}`));
    if (!records.length) {
        showMessage('Ничего не выбрано', 'error');
        return;
    }

    logAction('export_selected', { count: records.length });

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
    logAction('export_completed', { filename: `export_${new Date().toISOString().slice(0,19)}.xlsx` });
}

// ========== ОТЧЁТЫ (ВСПЛЫВАЮЩЕЕ ОКНО) ==========
function openStatsReport() {
    const selectedRecords = filteredHistoryRecords.filter(r => selectedIds.has(`${r.source}_${r.id}`));
    if (selectedRecords.length === 0) {
        showMessage('Не выбрано ни одной записи для отчёта', 'error');
        return;
    }

    logAction('open_stats_report', { count: selectedRecords.length });

    const consultationRecords = selectedRecords.filter(r => r.source === 'consultation');
    const dutyRecords = selectedRecords.filter(r => r.source === 'duty');
    const appealRecords = selectedRecords.filter(r => r.source === 'appeal');

    // Подсчёт статистики ДЛЯ ДЕЖУРКИ (отдельно)
    let dutyStats = {
        totalQuantity: 0,
        newTypes: [],
        newSolutions: [],
        tasks: [],
        errors: [],
        byPeriod: []
    };

    dutyRecords.forEach(record => {
        dutyStats.totalQuantity += record.quantity || 0;
        const measures = record.measures || [];

        dutyStats.newTypes.push(...measures.filter(m => m.type === 'new_type').map(m => m.value));
        dutyStats.newSolutions.push(...measures.filter(m => m.type === 'new_solution').map(m => m.value));
        dutyStats.tasks.push(...measures.filter(m => m.type === 'task').map(m => m.value));
        dutyStats.errors.push(...measures.filter(m => m.type === 'error').map(m => m.value));

        dutyStats.byPeriod.push({
            period: `${formatDate(record.period_from)} — ${formatDate(record.period_to)}`,
            quantity: record.quantity || 0,
            newTypes: measures.filter(m => m.type === 'new_type').map(m => m.value),
            newSolutions: measures.filter(m => m.type === 'new_solution').map(m => m.value),
            tasks: measures.filter(m => m.type === 'task').map(m => m.value),
            errors: measures.filter(m => m.type === 'error').map(m => m.value)
        });
    });

    // Подсчёт статистики ДЛЯ ОБРАЩЕНИЙ (отдельно)
    let appealStats = {
        newTypes: [],
        newSolutions: [],
        tasks: [],
        errors: [],
        helps: []
    };

    appealRecords.forEach(record => {
        const measures = record.measures || [];
        appealStats.newTypes.push(...measures.filter(m => m.type === 'new_type').map(m => m.value));
        appealStats.newSolutions.push(...measures.filter(m => m.type === 'new_solution').map(m => m.value));
        appealStats.tasks.push(...measures.filter(m => m.type === 'task').map(m => m.value));
        appealStats.errors.push(...measures.filter(m => m.type === 'error').map(m => m.value));
        appealStats.helps.push(...measures.filter(m => m.type === 'help').map(m => m.value));
    });

    // Создаём модальное окно (увеличенное)
    const modal = document.createElement('div');
    modal.className = 'modal stats-modal';
    modal.style.display = 'flex';

    let statsHtml = `
        <div style="background: white; padding: 30px; border-radius: 20px; width: 1400px; max-width: 95%; max-height: 85vh; overflow-y: auto; position: relative;">
            <button class="modal-close" onclick="this.closest('.modal').remove()" style="position: absolute; top: 18px; right: 20px; background: none; border: none; font-size: 26px; cursor: pointer;">✖️</button>
            <h2 style="margin-bottom: 20px; font-size: 24px;">📊 Сводная статистика</h2>
            <p style="color: #666; margin-bottom: 20px;">По выбранным записям (${selectedRecords.length} шт.)</p>

            <!-- Общая статистика (карточки) -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px;">
                <div style="background: linear-gradient(135deg, #667eea, #764ba2); color: white; padding: 20px; border-radius: 16px; text-align: center;">
                    <div style="font-size: 32px; font-weight: bold;">${selectedRecords.length}</div>
                    <div style="font-size: 13px; opacity: 0.9;">Всего записей</div>
                </div>
                <div style="background: #e3f2fd; color: #1976d2; padding: 20px; border-radius: 16px; text-align: center;">
                    <div style="font-size: 32px; font-weight: bold;">${consultationRecords.length}</div>
                    <div style="font-size: 13px;">Консультации</div>
                </div>
                <div style="background: #fff3e0; color: #f57c00; padding: 20px; border-radius: 16px; text-align: center;">
                    <div style="font-size: 32px; font-weight: bold;">${dutyStats.totalQuantity}</div>
                    <div style="font-size: 13px;">Дежурка (обращений)</div>
                </div>
                <div style="background: #f3e5f5; color: #7b1fa2; padding: 20px; border-radius: 16px; text-align: center;">
                    <div style="font-size: 32px; font-weight: bold;">${appealRecords.length}</div>
                    <div style="font-size: 13px;">Обращения</div>
                </div>
            </div>
    `;

    // Блок ДЕЖУРКИ
    if (dutyRecords.length > 0) {
        statsHtml += `
            <div style="margin-bottom: 25px; border: 1px solid #e0e0e0; border-radius: 16px; overflow: hidden;">
                <div onclick="toggleSection(this)" style="cursor: pointer; background: #f8f9fa; padding: 16px 20px; font-weight: 700; font-size: 18px; display: flex; justify-content: space-between; align-items: center;">
                    <span>🚪 Дежурка</span>
                    <span style="font-size: 20px; color: #667eea;">▾</span>
                </div>
                <div class="section-content" style="display: none; padding: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 25px;">
                        <div style="background: #f0f4f8; padding: 16px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 28px; font-weight: bold; color: #17a2b8;">${dutyStats.newTypes.length}</div>
                            <div style="font-size: 12px; color: #555;">Новых видов</div>
                        </div>
                        <div style="background: #f0f4f8; padding: 16px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 28px; font-weight: bold; color: #28a745;">${dutyStats.newSolutions.length}</div>
                            <div style="font-size: 12px; color: #555;">Новых решений</div>
                        </div>
                        <div style="background: #f0f4f8; padding: 16px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 28px; font-weight: bold; color: #ffc107;">${dutyStats.tasks.length}</div>
                            <div style="font-size: 12px; color: #555;">Задач</div>
                        </div>
                        <div style="background: #f0f4f8; padding: 16px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 28px; font-weight: bold; color: #dc3545;">${dutyStats.errors.length}</div>
                            <div style="font-size: 12px; color: #555;">Ошибок</div>
                        </div>
                    </div>
                    <div style="font-weight: 600; margin-bottom: 12px;">📅 Детализация по периодам</div>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${dutyStats.byPeriod.map(p => `
                            <div style="background: #f8f9fa; padding: 14px; border-radius: 12px; margin-bottom: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <strong style="font-size: 14px;">📅 ${p.period}</strong>
                                    <span style="background: #667eea; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px;">${p.quantity} обращений</span>
                                </div>
                                <div style="display: flex; flex-wrap: wrap; gap: 15px; font-size: 13px; margin-top: 8px;">
                                    ${p.newTypes.length > 0 ? `<span>🆕 Новые виды: ${p.newTypes.join(', ')}</span>` : ''}
                                    ${p.newSolutions.length > 0 ? `<span>💡 Новые решения: ${p.newSolutions.join(', ')}</span>` : ''}
                                    ${p.tasks.length > 0 ? `<span>🚀 Задачи: ${p.tasks.length}</span>` : ''}
                                    ${p.errors.length > 0 ? `<span>⚠️ Ошибки: ${p.errors.length}</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div style="margin-top: 15px; padding-top: 12px; border-top: 1px solid #e0e0e0; font-weight: 600;">
                        Итого обращений: <span style="color: #667eea;">${dutyStats.totalQuantity}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Блок ОБРАЩЕНИЙ
    if (appealRecords.length > 0) {
        statsHtml += `
            <div style="margin-bottom: 25px; border: 1px solid #e0e0e0; border-radius: 16px; overflow: hidden;">
                <div onclick="toggleSection(this)" style="cursor: pointer; background: #f8f9fa; padding: 16px 20px; font-weight: 700; font-size: 18px; display: flex; justify-content: space-between; align-items: center;">
                    <span>📞 Обращения</span>
                    <span style="font-size: 20px; color: #667eea;">▾</span>
                </div>
                <div class="section-content" style="display: none; padding: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px; margin-bottom: 25px;">
                        <div style="background: #f0f4f8; padding: 16px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 28px; font-weight: bold; color: #17a2b8;">${appealStats.newTypes.length}</div>
                            <div style="font-size: 12px; color: #555;">Новых видов</div>
                        </div>
                        <div style="background: #f0f4f8; padding: 16px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 28px; font-weight: bold; color: #28a745;">${appealStats.newSolutions.length}</div>
                            <div style="font-size: 12px; color: #555;">Новых решений</div>
                        </div>
                        <div style="background: #f0f4f8; padding: 16px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 28px; font-weight: bold; color: #ffc107;">${appealStats.tasks.length}</div>
                            <div style="font-size: 12px; color: #555;">Задач</div>
                        </div>
                        <div style="background: #f0f4f8; padding: 16px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 28px; font-weight: bold; color: #dc3545;">${appealStats.errors.length}</div>
                            <div style="font-size: 12px; color: #555;">Ошибок</div>
                        </div>
                        <div style="background: #f0f4f8; padding: 16px; border-radius: 12px; text-align: center;">
                            <div style="font-size: 28px; font-weight: bold; color: #6f42c1;">${appealStats.helps.length}</div>
                            <div style="font-size: 12px; color: #555;">HELP</div>
                        </div>
                    </div>
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${appealRecords.map(r => `
                            <div style="background: #f8f9fa; padding: 14px; border-radius: 12px; margin-bottom: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <strong style="font-size: 14px;">📅 ${formatDate(r.displayDate)}</strong>
                                </div>
                                <div><a href="${r.link}" target="_blank" style="color: #667eea;">${r.link.length > 70 ? r.link.substring(0, 70) + '...' : r.link}</a></div>
                                <div style="font-size: 13px; color: #555;">💬 ${r.comment || '—'}</div>
                                <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;">
                                    ${(r.measures || []).map(m => {
                                        switch(m.type) {
                                            case 'new_type': return `<span style="background: #e3f2fd; padding: 2px 10px; border-radius: 20px; font-size: 11px;">🆕 ${m.value}</span>`;
                                            case 'new_solution': return `<span style="background: #e8f5e9; padding: 2px 10px; border-radius: 20px; font-size: 11px;">💡 ${m.value}</span>`;
                                            case 'task': return `<span style="background: #fff3e0; padding: 2px 10px; border-radius: 20px; font-size: 11px;">🚀 Задача</span>`;
                                            case 'error': return `<span style="background: #ffebee; padding: 2px 10px; border-radius: 20px; font-size: 11px;">⚠️ Ошибка</span>`;
                                            case 'help': return `<span style="background: #f3e5f5; padding: 2px 10px; border-radius: 20px; font-size: 11px;">📚 HELP</span>`;
                                            default: return '';
                                        }
                                    }).join(' ')}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Блок КОНСУЛЬТАЦИЙ
    if (consultationRecords.length > 0) {
        statsHtml += `
            <div style="margin-bottom: 25px; border: 1px solid #e0e0e0; border-radius: 16px; overflow: hidden;">
                <div onclick="toggleSection(this)" style="cursor: pointer; background: #f8f9fa; padding: 16px 20px; font-weight: 700; font-size: 18px; display: flex; justify-content: space-between; align-items: center;">
                    <span>📋 Сценарии консультаций</span>
                    <span style="font-size: 20px; color: #667eea;">▾</span>
                </div>
                <div class="section-content" style="display: none; padding: 20px;">
                    <div style="max-height: 300px; overflow-y: auto;">
                        ${consultationRecords.map(r => `
                            <div style="background: #f8f9fa; padding: 14px; border-radius: 12px; margin-bottom: 10px;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                    <strong style="font-size: 14px;">📅 ${formatDate(r.displayDate)}</strong>
                                </div>
                                <div><a href="${r.link}" target="_blank" style="color: #667eea;">${r.link.length > 70 ? r.link.substring(0, 70) + '...' : r.link}</a></div>
                                <div style="font-size: 13px; color: #555;">💬 ${r.comment || '—'}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    statsHtml += `
            <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px;">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()" style="padding: 10px 24px;">✖️ Закрыть</button>
                <button id="exportStatsBtn" class="btn btn-success" style="padding: 10px 24px;">📎 Экспорт отчёта в Excel</button>
            </div>
        </div>
    `;

    modal.innerHTML = statsHtml;
    document.body.appendChild(modal);

    document.getElementById('exportStatsBtn').onclick = () => {
        exportStatsReport(selectedRecords);
        modal.remove();
    };
}

// Функция для сворачивания/разворачивания (тонкая стрелка)
window.toggleSection = function(header) {
    const content = header.nextElementSibling;
    const arrow = header.querySelector('span:last-child');
    if (content) {
        if (content.style.display === 'none') {
            content.style.display = 'block';
            arrow.innerHTML = '▾';
        } else {
            content.style.display = 'none';
            arrow.innerHTML = '▸';
        }
    }
};

function openEditAppealModal(id, data) {
    // Формируем HTML для мер
    let measuresHtml = '';
    if (data.measures && data.measures.length > 0) {
        measuresHtml = data.measures.map((m, idx) => {
            let typeClass = '', title = '';
            switch(m.type) {
                case 'new-type': typeClass = 'new-type'; title = '🆕 Новый вид'; break;
                case 'new-solution': typeClass = 'new-solution'; title = '💡 Новое решение'; break;
                case 'task': typeClass = 'task'; title = '🚀 Задача'; break;
                case 'error': typeClass = 'error'; title = '⚠️ Ошибка'; break;
                case 'help': typeClass = 'help'; title = '📚 Изменение документации HELP'; break;
            }
            return `
                <div class="measure-card measure-${typeClass}" style="background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #e0e0e0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong>${title}</strong>
                        <button type="button" class="remove-measure-btn" style="background: #dc3545; color: white; border: none; border-radius: 5px; padding: 4px 8px; cursor: pointer;" onclick="this.closest('.measure-card').remove()">✖️</button>
                    </div>
                    <input type="${m.type === 'task' || m.type === 'error' ? 'url' : 'text'}" class="measure-value" value="${(m.value || '').replace(/"/g, '&quot;')}" placeholder="Введите значение" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
                </div>
            `;
        }).join('');
    }

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div style="background: white; padding: 30px; border-radius: 15px; width: 600px; max-width: 90%; max-height: 80vh; overflow-y: auto; position: relative;">
            <button class="modal-close" onclick="this.closest('.modal').remove()" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer;">✖️</button>
            <h3 style="margin-bottom: 20px;">✏️ Редактировать обращение #${id}</h3>

            <div class="form-group">
                <label>🔗 Ссылка</label>
                <input type="url" id="editLink" value="${data.link || ''}" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">
            </div>

            <div class="form-group">
                <label>💬 Комментарий</label>
                <textarea id="editComment" rows="3" style="width: 100%; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px;">${data.comment || ''}</textarea>
            </div>

            <div class="form-group">
                <label>📋 Меры</label>
                <div id="editMeasuresContainer">
                    ${measuresHtml || '<div style="color: #999; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px;">Нет мер. Добавьте ниже.</div>'}
                </div>
                <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
                    <button type="button" class="btn btn-small" id="addNewTypeEditBtn" style="background: #17a2b8; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;">➕ Новый вид</button>
                    <button type="button" class="btn btn-small" id="addNewSolutionEditBtn" style="background: #17a2b8; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;">➕ Новое решение</button>
                    <button type="button" class="btn btn-small" id="addTaskEditBtn" style="background: #17a2b8; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;">➕ Задача</button>
                    <button type="button" class="btn btn-small" id="addErrorEditBtn" style="background: #17a2b8; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;">➕ Ошибка</button>
                    <button type="button" class="btn btn-small" id="addHelpEditBtn" style="background: #6f42c1; color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer;">📚 + HELP</button>
                </div>
            </div>

            <div style="display: flex; gap: 10px; margin-top: 25px; justify-content: flex-end;">
                <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">❌ Отмена</button>
                <button id="saveEditBtn" class="btn btn-primary">💾 Сохранить</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Добавление мер в модальном окне
    const addMeasureToModal = (type) => {
        const container = document.getElementById('editMeasuresContainer');
        if (!container) return;
        if (container.innerHTML.includes('Нет мер')) container.innerHTML = '';

        let title = '', placeholder = '', inputType = 'text';
        switch(type) {
            case 'new-type': title = '🆕 Новый вид'; placeholder = 'Введите новый вид'; break;
            case 'new-solution': title = '💡 Новое решение'; placeholder = 'Введите новое решение'; break;
            case 'task': title = '🚀 Задача'; placeholder = 'Ссылка на задачу'; inputType = 'url'; break;
            case 'error': title = '⚠️ Ошибка'; placeholder = 'Ссылка на ошибку'; inputType = 'url'; break;
            case 'help': title = '📚 HELP'; placeholder = 'Описание изменения документации'; break;
        }

        const blockDiv = document.createElement('div');
        blockDiv.className = `measure-card measure-${type}`;
        blockDiv.style.cssText = 'background: #f8f9fa; padding: 12px; border-radius: 8px; margin-bottom: 10px; border: 1px solid #e0e0e0;';
        blockDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <strong>${title}</strong>
                <button type="button" class="remove-measure-btn" style="background: #dc3545; color: white; border: none; border-radius: 5px; padding: 4px 8px; cursor: pointer;" onclick="this.closest('.measure-card').remove()">✖️</button>
            </div>
            <input type="${inputType}" class="measure-value" placeholder="${placeholder}" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
        `;
        container.appendChild(blockDiv);
    };

    document.getElementById('addNewTypeEditBtn')?.addEventListener('click', () => addMeasureToModal('new-type'));
    document.getElementById('addNewSolutionEditBtn')?.addEventListener('click', () => addMeasureToModal('new-solution'));
    document.getElementById('addTaskEditBtn')?.addEventListener('click', () => addMeasureToModal('task'));
    document.getElementById('addErrorEditBtn')?.addEventListener('click', () => addMeasureToModal('error'));
    document.getElementById('addHelpEditBtn')?.addEventListener('click', () => addMeasureToModal('help'));

    document.getElementById('saveEditBtn').onclick = async () => {
        const measures = [];
        document.querySelectorAll('#editMeasuresContainer .measure-card').forEach(card => {
            const value = card.querySelector('.measure-value')?.value;
            if (!value || value.trim() === '') return;
            if (card.classList.contains('measure-new-type')) measures.push({ type: 'new_type', value: value.trim() });
            else if (card.classList.contains('measure-new-solution')) measures.push({ type: 'new_solution', value: value.trim() });
            else if (card.classList.contains('measure-task')) measures.push({ type: 'task', value: value.trim() });
            else if (card.classList.contains('measure-error')) measures.push({ type: 'error', value: value.trim() });
            else if (card.classList.contains('measure-help')) measures.push({ type: 'help', value: value.trim() });
        });

        const updates = {
            link: document.getElementById('editLink').value,
            comment: document.getElementById('editComment').value || null,
            measures: measures
        };

        const { error } = await sb.from('appeals').update(updates).eq('id', id);
        if (error) {
            showMessage(`❌ ${error.message}`, 'error');
        } else {
            showMessage('✅ Обращение обновлено', 'success');
        }
        modal.remove();
        if (typeof loadHistoryData === 'function') loadHistoryData();
    };
}

function exportStatsReport(records) {
    logAction('export_stats_report', { count: records.length });

    const consultationRecords = records.filter(r => r.source === 'consultation');
    const dutyRecords = records.filter(r => r.source === 'duty');
    const wb = XLSX.utils.book_new();

    // Сводная статистика
    const summaryData = [
        ['СВОДНЫЙ ОТЧЕТ ПО ВЫБРАННЫМ ЗАПИСЯМ'],
        [`Дата формирования: ${new Date().toLocaleString()}`],
        [`Всего записей: ${records.length}`],
        [],
        ['ДЕЖУРКА'],
        ['Период', 'Количество', 'Новых видов', 'Новых решений', 'Задач', 'Ошибок']
    ];

    let totalQuantity = 0, totalNewTypes = 0, totalNewSolutions = 0, totalTasks = 0, totalErrors = 0;

    dutyRecords.forEach(record => {
        const measures = record.measures || [];
        const qty = record.quantity || 0;
        totalQuantity += qty;
        totalNewTypes += measures.filter(m => m.type === 'new_type').length;
        totalNewSolutions += measures.filter(m => m.type === 'new_solution').length;
        totalTasks += measures.filter(m => m.type === 'task').length;
        totalErrors += measures.filter(m => m.type === 'error').length;

        summaryData.push([
            `${formatDate(record.period_from)} — ${formatDate(record.period_to)}`,
            qty,
            measures.filter(m => m.type === 'new_type').length,
            measures.filter(m => m.type === 'new_solution').length,
            measures.filter(m => m.type === 'task').length,
            measures.filter(m => m.type === 'error').length
        ]);
    });

    summaryData.push(['ИТОГО ПО ДЕЖУРКЕ:', totalQuantity, totalNewTypes, totalNewSolutions, totalTasks, totalErrors]);
    summaryData.push([]);
    summaryData.push(['СЦЕНАРИИ КОНСУЛЬТАЦИЙ']);
    summaryData.push(['Дата', 'Ссылка', 'Комментарий']);

    consultationRecords.forEach(record => {
        summaryData.push([formatDate(record.displayDate), record.link || '', record.comment || '']);
    });
    summaryData.push([`ВСЕГО ЗАПИСЕЙ: ${consultationRecords.length}`]);

    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws, 'Сводный отчет');

    XLSX.writeFile(wb, `stats_report_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.xlsx`);
    showMessage(`✅ Отчёт экспортирован (${records.length} записей)`, 'success');
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    logAction('page_loaded', { url: window.location.href });
    checkSavedAuth();

    // Авторизация
    document.getElementById('loginBtn')?.addEventListener('click', openLoginModal);
    document.getElementById('demoLoginBtn')?.addEventListener('click', demoLogin);
    document.getElementById('logoutBtn')?.addEventListener('click', logout);
    document.getElementById('closeLoginModal')?.addEventListener('click', closeLoginModal);

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

    // Кнопка отчётов
    document.getElementById('statsReportBtn')?.addEventListener('click', openStatsReport);

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
        logAction('filters_updated', historyFilters);
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

// Обработчики для кнопок мер обращений
document.querySelectorAll('#appealsForm .btn-measure').forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.getAttribute('data-type');
        if (type) addAppealMeasure(type);
    });
});

// Добавление обращения
document.getElementById('addAppealBtn')?.addEventListener('click', async () => {
    const link = document.getElementById('appealLink').value.trim();
    if (!link) {
        showMessage('Введите ссылку', 'error');
        return;
    }
    const comment = document.getElementById('appealComment').value;
    const measures = collectAppealMeasures();
    await addAppeal(link, comment, measures);
});

    // Пагинация
    document.getElementById('prevPageBtn')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadHistoryData(); } });
    document.getElementById('nextPageBtn')?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; loadHistoryData(); } });
    document.getElementById('prevPageBtn2')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadHistoryData(); } });
    document.getElementById('nextPageBtn2')?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; loadHistoryData(); } });

    updateAuthUI();
    switchMainTab('add');
});