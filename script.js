// script.js
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRecords = [];
let filteredRecords = [];
let isLoading = false;
let cachedData = null;
let lastLoadTime = 0;
const CACHE_TTL = 60000; // 60 секунд

let currentFilters = {
    dateFrom: '',
    dateTo: '',
    table: 'all',
    text: ''
};

function showMessage(text, type) {
    let msgDiv = document.getElementById('message');
    if (!msgDiv) return;
    msgDiv.textContent = text;
    msgDiv.className = `message ${type}`;
    msgDiv.style.display = 'block';
    setTimeout(() => {
        if (msgDiv) msgDiv.style.display = 'none';
    }, 3000);
}

// ========== РАБОТА С МЕРАМИ ==========
function addMeasureByType(type) {
    const container = document.getElementById('measuresContainer');
    if (!container) return;

    const blockDiv = document.createElement('div');
    blockDiv.className = `measure-card measure-${type}`;

    let title = '', placeholder = '', inputType = 'text';

    switch(type) {
        case 'new-type':
            title = '🆕 Новый вид';
            placeholder = 'Введите новый вид';
            break;
        case 'new-solution':
            title = '💡 Новое решение';
            placeholder = 'Введите новое решение';
            break;
        case 'task':
            title = '🚀 Задача в разработку';
            placeholder = 'Ссылка на задачу';
            inputType = 'url';
            break;
        case 'error':
            title = '⚠️ Ошибка';
            placeholder = 'Ссылка на ошибку';
            inputType = 'url';
            break;
        default: return;
    }

    blockDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <strong>${title}</strong>
            <button type="button" class="remove-measure-btn" onclick="this.closest('.measure-card').remove()">✖️</button>
        </div>
        <input type="${inputType}" class="measure-value" placeholder="${placeholder}">
    `;

    container.appendChild(blockDiv);
}

function collectMeasures() {
    const measures = [];
    document.querySelectorAll('#measuresContainer .measure-card').forEach(card => {
        const value = card.querySelector('.measure-value')?.value;
        if (!value || value.trim() === '') return;

        if (card.classList.contains('measure-new-type')) {
            measures.push({ type: 'new_type', value: value.trim() });
        } else if (card.classList.contains('measure-new-solution')) {
            measures.push({ type: 'new_solution', value: value.trim() });
        } else if (card.classList.contains('measure-task')) {
            measures.push({ type: 'task', value: value.trim() });
        } else if (card.classList.contains('measure-error')) {
            measures.push({ type: 'error', value: value.trim() });
        }
    });
    return measures;
}

// ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========
function switchTab(tableName) {
    const consultationForm = document.getElementById('consultationForm');
    const dutyForm = document.getElementById('dutyRoomForm');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.table === tableName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    if (tableName === 'Consultation_scenario') {
        consultationForm.style.display = 'block';
        dutyForm.style.display = 'none';
    } else {
        consultationForm.style.display = 'none';
        dutyForm.style.display = 'block';
    }
}

// ========== ЗАГРУЗКА ДАННЫХ (С КЭШЕМ) ==========
async function loadAllData(forceRefresh = false) {
    if (isLoading) return;

    const now = Date.now();

    // Используем кэш если не принудительное обновление и кэш свежий
    if (!forceRefresh && cachedData && (now - lastLoadTime) < CACHE_TTL) {
        console.log('📦 Использую кэш');
        allRecords = cachedData;
        applyFilters();
        return;
    }

    isLoading = true;
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = 'flex';

    try {
        const startTime = performance.now();

        // Загружаем данные из обеих таблиц
        const [consResponse, dutyResponse] = await Promise.all([
            sb.from('Consultation_scenario').select('*'),
            sb.from('duty_room').select('*')
        ]);

        const endTime = performance.now();
        console.log(`⚡ Загрузка заняла ${(endTime - startTime).toFixed(0)} мс`);

        allRecords = [];

        // Добавляем консультации
        if (consResponse.data && consResponse.data.length > 0) {
            allRecords.push(...consResponse.data.map(r => ({
                id: r.id,
                source: 'consultation',
                sourceName: 'Сценарии консультаций',
                displayDate: r.created_at?.split('T')[0] || '',
                link: r.link,
                comment: r.comment
            })));
            console.log(`📋 Загружено консультаций: ${consResponse.data.length}`);
        } else if (consResponse.error) {
            console.error('Ошибка загрузки консультаций:', consResponse.error);
        }

        // Добавляем дежурку
        if (dutyResponse.data && dutyResponse.data.length > 0) {
            allRecords.push(...dutyResponse.data.map(r => ({
                id: r.id,
                source: 'duty',
                sourceName: 'Duty room',
                displayDate: r.period_from || '',
                period_from: r.period_from,
                period_to: r.period_to,
                period: r.period,
                quantity: r.quantity,
                measures: r.measures
            })));
            console.log(`🚪 Загружено дежурок: ${dutyResponse.data.length}`);
        } else if (dutyResponse.error) {
            console.error('Ошибка загрузки дежурки:', dutyResponse.error);
        }

        console.log(`📊 Всего записей: ${allRecords.length}`);

        // Сохраняем в кэш
        cachedData = allRecords;
        lastLoadTime = now;

        applyFilters();

    } catch (error) {
        console.error('❌ Ошибка загрузки:', error);
        const tbody = document.getElementById('tableBody');
        if (tbody) tbody.innerHTML = `<tr><td colspan="4" style="color: red;">Ошибка загрузки: ${error.message}<\/td><\/tr>`;
    } finally {
        if (spinner) spinner.style.display = 'none';
        isLoading = false;
    }
}

// ========== ФИЛЬТРАЦИЯ ==========
function applyFilters() {
    let filtered = [...allRecords];

    if (currentFilters.table !== 'all') {
        filtered = filtered.filter(r => r.source === currentFilters.table);
    }

    if (currentFilters.dateFrom) {
        filtered = filtered.filter(r => r.displayDate >= currentFilters.dateFrom);
    }

    if (currentFilters.dateTo) {
        filtered = filtered.filter(r => r.displayDate <= currentFilters.dateTo);
    }

    if (currentFilters.text) {
        const searchText = currentFilters.text.toLowerCase();
        filtered = filtered.filter(r => {
            if (r.source === 'consultation') {
                return (r.link?.toLowerCase().includes(searchText) ||
                       r.comment?.toLowerCase().includes(searchText));
            } else {
                return (r.period?.toLowerCase().includes(searchText) ||
                       JSON.stringify(r.measures).toLowerCase().includes(searchText));
            }
        });
    }

    filteredRecords = filtered;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('tableBody');

    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;">Нет записей<\/td><\/tr>';
        return;
    }

    // Сортируем по дате (новые сверху)
    filteredRecords.sort((a, b) => (b.displayDate || '').localeCompare(a.displayDate || ''));

    tbody.innerHTML = filteredRecords.map((record, index) => {
        let dataHtml = '';
        let sourceClass = record.source === 'consultation' ? 'source-consultation' : 'source-duty';
        let sourceText = record.source === 'consultation' ? '📋 Консультация' : '🚪 Дежурка';

        if (record.source === 'consultation') {
            dataHtml = `
                🔗 <a href="${record.link}" target="_blank">${record.link.length > 80 ? record.link.substring(0, 80) + '...' : record.link}</a><br>
                💬 Комментарий: ${record.comment || '—'}
            `;
        } else {
            let measuresHtml = '';
            if (record.measures && record.measures.length > 0) {
                measuresHtml = '<ul style="margin: 5px 0 0 15px;">' +
                    record.measures.map(m => {
                        switch(m.type) {
                            case 'new_type': return `<li>🆕 Новый вид: ${m.value}</li>`;
                            case 'new_solution': return `<li>💡 Новое решение: ${m.value}</li>`;
                            case 'task': return `<li>🚀 <a href="${m.value}" target="_blank">Задача</a></li>`;
                            case 'error': return `<li>⚠️ <a href="${m.value}" target="_blank">Ошибка</a></li>`;
                            default: return '';
                        }
                    }).join('') +
                    '</ul>';
            }

            dataHtml = `
                📅 Период: ${record.period_from && record.period_to ? `${record.period_from} — ${record.period_to}` : record.period}<br>
                🔢 Количество: ${record.quantity}<br>
                📋 Меры: ${measuresHtml || '—'}
            `;
        }

        return `
            <tr>
                <td>${index + 1}</td>
                <td><span class="source-badge ${sourceClass}">${sourceText}</span></td>
                <td>${dataHtml}</td>
                <td>
                    <button class="edit-btn" onclick="editRecord(${record.id}, '${record.source}')">✏️</button>
                    <button class="delete-btn" onclick="deleteRecord(${record.id}, '${record.source}')">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');
}

// ========== CRUD ==========
async function addConsultation(link, comment) {
    const { error } = await sb.from('Consultation_scenario').insert([{ link, comment: comment || null }]);
    if (error) { showMessage(`❌ ${error.message}`, 'error'); return false; }
    showMessage('✅ Консультация добавлена!', 'success');
    loadAllData(true);
    return true;
}

async function addDutyRecord(periodFrom, periodTo, quantity, measuresArray) {
    const periodText = `${periodFrom} — ${periodTo}`;
    const cleanMeasures = measuresArray.filter(m => m.value && m.value.trim() !== '');

    const { error } = await sb.from('duty_room').insert([{
        period_from: periodFrom,
        period_to: periodTo,
        period: periodText,
        quantity: parseInt(quantity),
        measures: cleanMeasures,
        created_at: new Date().toISOString()
    }]);

    if (error) { showMessage(`❌ ${error.message}`, 'error'); return false; }
    showMessage('✅ Запись в дежурку добавлена!', 'success');
    loadAllData(true);
    return true;
}

window.deleteRecord = async function(id, source) {
    if (!confirm('Удалить запись?')) return;
    const tableName = source === 'consultation' ? 'Consultation_scenario' : 'duty_room';
    const { error } = await sb.from(tableName).delete().eq('id', id);
    if (error) {
        showMessage(`❌ ${error.message}`, 'error');
    } else {
        showMessage('✅ Удалено', 'success');
        loadAllData(true);
    }
};

window.editRecord = async function(id, source) {
    const tableName = source === 'consultation' ? 'Consultation_scenario' : 'duty_room';
    const { data, error } = await sb.from(tableName).select('*').eq('id', id).single();
    if (error) { showMessage('Ошибка загрузки', 'error'); return; }

    const oldModal = document.querySelector('.modal');
    if (oldModal) oldModal.remove();

    const modal = document.createElement('div');
    modal.className = 'modal';

    if (source === 'duty') {
        modal.innerHTML = `
            <div>
                <h3>✏️ Редактировать запись #${id}</h3>
                <div class="form-group">
                    <label>Период (от)</label>
                    <input type="date" id="editPeriodFrom" value="${data.period_from || ''}">
                </div>
                <div class="form-group">
                    <label>Период (до)</label>
                    <input type="date" id="editPeriodTo" value="${data.period_to || ''}">
                </div>
                <div class="form-group">
                    <label>Количество</label>
                    <input type="number" id="editQuantity" value="${data.quantity || ''}">
                </div>
                <div class="form-group">
                    <label>Меры (JSON)</label>
                    <textarea id="editMeasures" rows="5">${JSON.stringify(data.measures || [], null, 2)}</textarea>
                    <small style="color: #666;">Формат: [{"type":"new_type","value":"значение"}, ...]</small>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button id="saveEditBtn" class="btn btn-primary">💾 Сохранить</button>
                    <button id="cancelEditBtn" class="btn btn-secondary">❌ Отмена</button>
                </div>
            </div>
        `;
    } else {
        modal.innerHTML = `
            <div>
                <h3>✏️ Редактировать запись #${id}</h3>
                <div class="form-group">
                    <label>Ссылка</label>
                    <input type="url" id="editLink" value="${data.link || ''}">
                </div>
                <div class="form-group">
                    <label>Комментарий</label>
                    <textarea id="editComment" rows="3">${data.comment || ''}</textarea>
                </div>
                <div style="display: flex; gap: 10px; margin-top: 20px;">
                    <button id="saveEditBtn" class="btn btn-primary">💾 Сохранить</button>
                    <button id="cancelEditBtn" class="btn btn-secondary">❌ Отмена</button>
                </div>
            </div>
        `;
    }

    document.body.appendChild(modal);

    document.getElementById('saveEditBtn').onclick = async () => {
        if (source === 'duty') {
            let measuresVal = null;
            try {
                const val = document.getElementById('editMeasures').value;
                if (val) measuresVal = JSON.parse(val);
            } catch(e) { measuresVal = []; }

            const updates = {
                period_from: document.getElementById('editPeriodFrom').value,
                period_to: document.getElementById('editPeriodTo').value,
                quantity: parseInt(document.getElementById('editQuantity').value),
                measures: measuresVal
            };
            updates.period = `${updates.period_from} — ${updates.period_to}`;
            await sb.from('duty_room').update(updates).eq('id', id);
        } else {
            const updates = {
                link: document.getElementById('editLink').value,
                comment: document.getElementById('editComment').value || null
            };
            await sb.from('Consultation_scenario').update(updates).eq('id', id);
        }
        showMessage('✅ Обновлено', 'success');
        modal.remove();
        loadAllData(true);
    };

    document.getElementById('cancelEditBtn').onclick = () => modal.remove();
};

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    // Вкладки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.table));
    });

    // Фильтр иконка
    const filterIcon = document.getElementById('filterIcon');
    if (filterIcon) {
        filterIcon.addEventListener('click', () => {
            const panel = document.getElementById('filterPanel');
            if (panel) {
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            }
        });
    }

    // Элементы фильтров
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');
    const filterTable = document.getElementById('filterTable');
    const filterText = document.getElementById('filterText');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');

    function updateFilters() {
        currentFilters = {
            dateFrom: filterDateFrom?.value || '',
            dateTo: filterDateTo?.value || '',
            table: filterTable?.value || 'all',
            text: filterText?.value || ''
        };
        applyFilters();
    }

    if (filterDateFrom) filterDateFrom.addEventListener('change', updateFilters);
    if (filterDateTo) filterDateTo.addEventListener('change', updateFilters);
    if (filterTable) filterTable.addEventListener('change', updateFilters);
    if (filterText) filterText.addEventListener('input', updateFilters);

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            if (filterDateFrom) filterDateFrom.value = '';
            if (filterDateTo) filterDateTo.value = '';
            if (filterTable) filterTable.value = 'all';
            if (filterText) filterText.value = '';
            updateFilters();
        });
    }

    // Меры
    const addNewTypeBtn = document.getElementById('addNewTypeBtn');
    const addNewSolutionBtn = document.getElementById('addNewSolutionBtn');
    const addTaskBtn = document.getElementById('addTaskBtn');
    const addErrorBtn = document.getElementById('addErrorBtn');

    if (addNewTypeBtn) addNewTypeBtn.addEventListener('click', () => addMeasureByType('new-type'));
    if (addNewSolutionBtn) addNewSolutionBtn.addEventListener('click', () => addMeasureByType('new-solution'));
    if (addTaskBtn) addTaskBtn.addEventListener('click', () => addMeasureByType('task'));
    if (addErrorBtn) addErrorBtn.addEventListener('click', () => addMeasureByType('error'));

    // Добавление консультации
    const addConsultationBtn = document.getElementById('addConsultationBtn');
    if (addConsultationBtn) {
        addConsultationBtn.addEventListener('click', async () => {
            const link = document.getElementById('consultationLink').value.trim();
            const comment = document.getElementById('consultationComment').value.trim();
            if (!link) { showMessage('❌ Введите ссылку', 'error'); return; }
            await addConsultation(link, comment);
            document.getElementById('consultationLink').value = '';
            document.getElementById('consultationComment').value = '';
        });
    }

    // Добавление в дежурку
    const addDutyBtn = document.getElementById('addDutyBtn');
    if (addDutyBtn) {
        addDutyBtn.addEventListener('click', async () => {
            const periodFrom = document.getElementById('dutyPeriodFrom').value;
            const periodTo = document.getElementById('dutyPeriodTo').value;
            const quantity = document.getElementById('dutyQuantity').value;
            const measures = collectMeasures();

            if (!periodFrom || !periodTo) { showMessage('❌ Выберите период', 'error'); return; }
            if (!quantity) { showMessage('❌ Введите количество', 'error'); return; }

            await addDutyRecord(periodFrom, periodTo, quantity, measures);

            document.getElementById('dutyPeriodFrom').value = '';
            document.getElementById('dutyPeriodTo').value = '';
            document.getElementById('dutyQuantity').value = '';
            const container = document.getElementById('measuresContainer');
            if (container) container.innerHTML = '';
        });
    }

    // Загружаем данные
    loadAllData();
});