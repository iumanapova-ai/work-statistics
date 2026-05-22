// script.js
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRecords = [];
let filteredRecords = [];
let isLoading = false;
let refreshCounter = 0;

let currentFilters = {
    dateFrom: '',
    dateTo: '',
    table: 'all',
    text: ''
};

let selectedIds = new Set();

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

function showSpinner(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.style.display = show ? 'flex' : 'none';
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(2);
    return `${day}.${month}.${year}`;
}

function addMeasureByType(type, containerId = 'measuresContainer') {
    const container = document.getElementById(containerId);
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
        <input type="${inputType}" class="measure-value" placeholder="${placeholder}" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 8px;">
    `;

    container.appendChild(blockDiv);
}

function collectMeasures(containerId = 'measuresContainer') {
    const measures = [];
    document.querySelectorAll(`#${containerId} .measure-card`).forEach(card => {
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

async function loadAllData() {
    if (isLoading) return;

    isLoading = true;
    showSpinner(true);

    try {
        refreshCounter++;
        console.log(`🔄 Загрузка #${refreshCounter}`);

        const [consResponse, dutyResponse] = await Promise.all([
            sb.from('Consultation_scenario').select('*'),
            sb.from('duty_room').select('*')
        ]);

        const newRecords = [];

        if (consResponse.data) {
            newRecords.push(...consResponse.data.map(r => ({
                id: r.id,
                source: 'consultation',
                sourceName: 'Сценарии консультаций',
                displayDate: r.created_at?.split('T')[0] || '',
                created_at: r.created_at || new Date(0).toISOString(),
                link: r.link || '',
                comment: r.comment || ''
            })));
        }

        if (dutyResponse.data) {
            newRecords.push(...dutyResponse.data.map(r => ({
                id: r.id,
                source: 'duty',
                sourceName: 'Дежурка',
                displayDate: r.period_from || '',
                created_at: r.created_at || new Date(0).toISOString(),
                period_from: r.period_from || '',
                period_to: r.period_to || '',
                period: r.period || '',
                quantity: r.quantity || 0,
                measures: r.measures || []
            })));
        }

        newRecords.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        allRecords = newRecords;

        applyFilters();

    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('Ошибка загрузки данных', 'error');
    } finally {
        showSpinner(false);
        isLoading = false;
    }
}

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
        filtered = filtered.filter(r => JSON.stringify(r).toLowerCase().includes(searchText));
    }

    filteredRecords = filtered;
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;

    if (filteredRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Нет записей<\/td><\/tr>';
        return;
    }

    tbody.innerHTML = filteredRecords.map((record, index) => {
        let dataHtml = '';
        let sourceClass = record.source === 'consultation' ? 'source-consultation' : 'source-duty';
        let sourceText = record.source === 'consultation' ? '📋 Консультация' : '🚪 Дежурка';

        if (record.source === 'consultation') {
            dataHtml = `🔗 <a href="${record.link}" target="_blank">${record.link}</a><br>💬 ${record.comment || '—'}`;
        } else {
            let measuresHtml = '';
            if (record.measures?.length) {
                measuresHtml = '<ul>' + record.measures.map(m => {
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
                <td><input type="checkbox" class="row-checkbox" data-source="${record.source}" data-id="${record.id}" ${selectedIds.has(`${record.source}_${record.id}`) ? 'checked' : ''}></td>
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
    const allSelected = filteredRecords.length > 0 && filteredRecords.every(r => selectedIds.has(`${r.source}_${r.id}`));
    const someSelected = filteredRecords.some(r => selectedIds.has(`${r.source}_${r.id}`));
    selectAll.checked = allSelected;
    selectAll.indeterminate = someSelected && !allSelected;
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll.checked) {
        filteredRecords.forEach(r => selectedIds.add(`${r.source}_${r.id}`));
    } else {
        filteredRecords.forEach(r => selectedIds.delete(`${r.source}_${r.id}`));
    }
    renderTable();
}

async function addConsultation(link, comment) {
    const { error } = await sb.from('Consultation_scenario').insert([{ link, comment, created_at: new Date().toISOString() }]);
    if (error) { showMessage(`❌ ${error.message}`, 'error'); return; }
    showMessage('✅ Добавлено', 'success');
    document.getElementById('consultationLink').value = '';
    document.getElementById('consultationComment').value = '';
    await loadAllData();
}

async function addDutyRecord(periodFrom, periodTo, quantity, measures) {
    const { error } = await sb.from('duty_room').insert([{
        period_from: periodFrom, period_to: periodTo, period: `${periodFrom} — ${periodTo}`,
        quantity: parseInt(quantity), measures, created_at: new Date().toISOString()
    }]);
    if (error) { showMessage(`❌ ${error.message}`, 'error'); return; }
    showMessage('✅ Добавлено', 'success');
    document.getElementById('dutyPeriodFrom').value = '';
    document.getElementById('dutyPeriodTo').value = '';
    document.getElementById('dutyQuantity').value = '';
    document.getElementById('measuresContainer').innerHTML = '';
    await loadAllData();
}

window.deleteRecord = async (id, source) => {
    if (!confirm('Удалить?')) return;
    const table = source === 'consultation' ? 'Consultation_scenario' : 'duty_room';
    await sb.from(table).delete().eq('id', id);
    selectedIds.delete(`${source}_${id}`);
    await loadAllData();
};

window.editRecord = async (id, source) => {
    const newVal = prompt('Новое значение (JSON для дежурки, ссылка для консультации)');
    if (!newVal) return;
    const table = source === 'consultation' ? 'Consultation_scenario' : 'duty_room';
    if (source === 'consultation') {
        await sb.from(table).update({ link: newVal }).eq('id', id);
    } else {
        try {
            const updates = JSON.parse(newVal);
            await sb.from(table).update(updates).eq('id', id);
        } catch(e) { showMessage('Ошибка JSON', 'error'); return; }
    }
    await loadAllData();
};
//Экспорт данных в эксель
function exportSelected() {
    const selectedRecords = filteredRecords.filter(r => selectedIds.has(`${r.source}_${r.id}`));
    if (selectedRecords.length === 0) {
        showMessage('Не выбрано ни одной записи', 'error');
        return;
    }

    const consultationRecords = selectedRecords.filter(r => r.source === 'consultation');
    const dutyRecords = selectedRecords.filter(r => r.source === 'duty');

    const wb = XLSX.utils.book_new();

    // ========== 1. СВОДНЫЙ ОТЧЕТ (первый лист) ==========
    if (dutyRecords.length > 0 || consultationRecords.length > 0) {
        const summaryData = [];

        if (dutyRecords.length > 0) {
            summaryData.push(['ДЕЖУРКА']);
            summaryData.push(['Период', 'Количество', 'Новых видов', 'Новых решений', 'Задач', 'Ошибок']);

            let totalDutyQuantity = 0, totalDutyNewTypes = 0, totalDutyNewSolutions = 0, totalDutyTasks = 0, totalDutyErrors = 0;

            dutyRecords.forEach(record => {
                const measures = record.measures || [];
                const qty = record.quantity || 0;
                totalDutyQuantity += qty;
                totalDutyNewTypes += measures.filter(m => m.type === 'new_type').length;
                totalDutyNewSolutions += measures.filter(m => m.type === 'new_solution').length;
                totalDutyTasks += measures.filter(m => m.type === 'task').length;
                totalDutyErrors += measures.filter(m => m.type === 'error').length;

                summaryData.push([
                    `${formatDate(record.period_from)} — ${formatDate(record.period_to)}`,
                    qty,
                    measures.filter(m => m.type === 'new_type').length,
                    measures.filter(m => m.type === 'new_solution').length,
                    measures.filter(m => m.type === 'task').length,
                    measures.filter(m => m.type === 'error').length
                ]);
            });

            summaryData.push(['ИТОГО ПО ДЕЖУРКЕ:', totalDutyQuantity, totalDutyNewTypes, totalDutyNewSolutions, totalDutyTasks, totalDutyErrors]);
            summaryData.push([]);
        }

        if (consultationRecords.length > 0) {
            summaryData.push(['СЦЕНАРИИ КОНСУЛЬТАЦИЙ']);
            summaryData.push(['Дата', 'Ссылка', 'Комментарий']);

            consultationRecords.forEach(record => {
                summaryData.push([formatDate(record.displayDate), record.link || '', record.comment || '']);
            });

            summaryData.push([]);
            summaryData.push([`ВСЕГО ЗАПИСЕЙ: ${consultationRecords.length}`]);
        }

        const ws = XLSX.utils.aoa_to_sheet(summaryData);
        ws['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 40 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws, '📊 Сводный отчет');
    }

    // ========== 2. ДЕЖУРКА (отдельный лист) ==========
    if (dutyRecords.length > 0) {
        const dutyData = [];

        // Основная таблица
        dutyData.push(['Период', 'Количество обращений']);

        let totalQuantity = 0;
        const allNewTypes = [];
        const allNewSolutions = [];
        const allTasks = [];
        const allErrors = [];

        dutyRecords.forEach(record => {
            const measures = record.measures || [];
            const qty = record.quantity || 0;
            totalQuantity += qty;

            dutyData.push([`${formatDate(record.period_from)} — ${formatDate(record.period_to)}`, qty]);

            allNewTypes.push(...measures.filter(m => m.type === 'new_type').map(m => m.value));
            allNewSolutions.push(...measures.filter(m => m.type === 'new_solution').map(m => m.value));
            allTasks.push(...measures.filter(m => m.type === 'task').map(m => m.value));
            allErrors.push(...measures.filter(m => m.type === 'error').map(m => m.value));
        });

        dutyData.push(['ИТОГО:', totalQuantity]);
        dutyData.push([]);

        // Таблица мер
        dutyData.push(['Меры']);
        dutyData.push(['Новый вид', 'Новое решение', 'Задача в разработку', 'Ошибка']);

        const maxRows = Math.max(allNewTypes.length, allNewSolutions.length, allTasks.length, allErrors.length);
        for (let i = 0; i < maxRows; i++) {
            dutyData.push([
                allNewTypes[i] || '',
                allNewSolutions[i] || '',
                allTasks[i] || '',
                allErrors[i] || ''
            ]);
        }

        dutyData.push(['ИТОГО ПО МЕРАМ:', allNewTypes.length, allNewSolutions.length, allTasks.length, allErrors.length]);

        const ws = XLSX.utils.aoa_to_sheet(dutyData);
        ws['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 40 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws, '🚪 Дежурка');
    }

    // ========== 3. КОНСУЛЬТАЦИИ (отдельный лист) ==========
    if (consultationRecords.length > 0) {
        const consData = [
            ['Дата', 'Ссылка', 'Комментарий']
        ];

        consultationRecords.forEach(record => {
            consData.push([formatDate(record.displayDate), record.link || '', record.comment || '']);
        });

        consData.push([]);
        consData.push([`ВСЕГО ЗАПИСЕЙ: ${consultationRecords.length}`]);

        const ws = XLSX.utils.aoa_to_sheet(consData);
        ws['!cols'] = [{ wch: 12 }, { wch: 50 }, { wch: 40 }];
        XLSX.utils.book_append_sheet(wb, ws, '📋 Консультации');
    }

    const date = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    XLSX.writeFile(wb, `export_${date}.xlsx`);
    showMessage(`✅ Экспортировано ${selectedRecords.length} записей`, 'success');
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', () => {
    console.log('🟢 Страница загружена, инициализация...');

    // Вкладки
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.table));
    });

    // Кнопка обновления
    document.getElementById('manualRefreshBtn')?.addEventListener('click', async () => {
        showMessage('🔄 Обновление...', 'success');
        await loadAllData();
        showMessage('✅ Данные обновлены', 'success');
    });

    // Экспорт
    document.getElementById('exportSelectedBtn')?.addEventListener('click', exportSelected);
    document.getElementById('selectAllCheckbox')?.addEventListener('change', toggleSelectAll);

    // Фильтры
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

    // Кнопки мер
    document.getElementById('addNewTypeBtn')?.addEventListener('click', () => addMeasureByType('new-type', 'measuresContainer'));
    document.getElementById('addNewSolutionBtn')?.addEventListener('click', () => addMeasureByType('new-solution', 'measuresContainer'));
    document.getElementById('addTaskBtn')?.addEventListener('click', () => addMeasureByType('task', 'measuresContainer'));
    document.getElementById('addErrorBtn')?.addEventListener('click', () => addMeasureByType('error', 'measuresContainer'));

    // Добавление консультации
    document.getElementById('addConsultationBtn')?.addEventListener('click', async () => {
        const link = document.getElementById('consultationLink').value.trim();
        const comment = document.getElementById('consultationComment').value.trim();
        if (!link) { showMessage('❌ Введите ссылку', 'error'); return; }
        await addConsultation(link, comment);
    });

    // Добавление в дежурку
    document.getElementById('addDutyBtn')?.addEventListener('click', async () => {
        const periodFrom = document.getElementById('dutyPeriodFrom').value;
        const periodTo = document.getElementById('dutyPeriodTo').value;
        const quantity = document.getElementById('dutyQuantity').value;
        const measures = collectMeasures('measuresContainer');

        if (!periodFrom || !periodTo) { showMessage('❌ Выберите период', 'error'); return; }
        if (!quantity) { showMessage('❌ Введите количество', 'error'); return; }

        await addDutyRecord(periodFrom, periodTo, quantity, measures);
    });

    // Загружаем данные
    loadAllData();
});