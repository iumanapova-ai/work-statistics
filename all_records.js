// all_records.js - страница всех записей
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let allRecords = [];
let filteredRecords = [];
let currentPage = 1;
let totalPages = 1;
const PAGE_SIZE = 25;
let isLoading = false;

let currentFilters = { dateFrom: '', dateTo: '', table: 'all', text: '' };
let selectedIds = new Set();

function showMessage(text, type) {
    let msgDiv = document.getElementById('message');
    if (!msgDiv) return;
    msgDiv.textContent = text;
    msgDiv.className = `message ${type}`;
    msgDiv.style.display = 'block';
    setTimeout(() => { if (msgDiv) msgDiv.style.display = 'none'; }, 3000);
}

function showSpinner(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getFullYear()).slice(2)}`;
}

async function loadAllData() {
    if (isLoading) return;
    isLoading = true;
    showSpinner(true);

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
        allRecords = newRecords;

        updatePageInfo();
        applyFilters();
    } catch (error) {
        console.error('Ошибка:', error);
        showMessage('Ошибка загрузки', 'error');
    } finally {
        showSpinner(false);
        isLoading = false;
    }
}

function updatePageInfo() {
    const pageText = `Страница ${currentPage} из ${totalPages || 1}`;
    document.getElementById('pageInfo').textContent = pageText;
    document.getElementById('pageInfo2').textContent = pageText;
    document.getElementById('prevPageBtn').disabled = currentPage <= 1;
    document.getElementById('prevPageBtn2').disabled = currentPage <= 1;
    document.getElementById('nextPageBtn').disabled = currentPage >= totalPages;
    document.getElementById('nextPageBtn2').disabled = currentPage >= totalPages;
}

function applyFilters() {
    let filtered = [...allRecords];
    if (currentFilters.table !== 'all') filtered = filtered.filter(r => r.source === currentFilters.table);
    if (currentFilters.dateFrom) filtered = filtered.filter(r => r.displayDate >= currentFilters.dateFrom);
    if (currentFilters.dateTo) filtered = filtered.filter(r => r.displayDate <= currentFilters.dateTo);
    if (currentFilters.text) {
        const s = currentFilters.text.toLowerCase();
        filtered = filtered.filter(r => JSON.stringify(r).toLowerCase().includes(s));
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
        const isChecked = selectedIds.has(`${record.source}_${record.id}`);

        if (record.source === 'consultation') {
            dataHtml = `🔗 <a href="${record.link}" target="_blank">${record.link.length > 60 ? record.link.substring(0, 60) + '...' : record.link}</a><br>💬 ${record.comment || '—'}`;
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
    const allSelected = filteredRecords.length > 0 && filteredRecords.every(r => selectedIds.has(`${r.source}_${r.id}`));
    const someSelected = filteredRecords.some(r => selectedIds.has(`${r.source}_${r.id}`));
    selectAll.checked = allSelected;
    selectAll.indeterminate = someSelected && !allSelected;
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAllCheckbox');
    if (selectAll.checked) filteredRecords.forEach(r => selectedIds.add(`${r.source}_${r.id}`));
    else filteredRecords.forEach(r => selectedIds.delete(`${r.source}_${r.id}`));
    renderTable();
}

window.deleteRecord = async (id, source) => {
    if (!confirm('Удалить?')) return;
    const table = source === 'consultation' ? 'Consultation_scenario' : 'duty_room';
    await sb.from(table).delete().eq('id', id);
    await loadAllData();
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
    await loadAllData();
    showMessage('✅ Обновлено', 'success');
};

function exportSelected() {
    const records = filteredRecords.filter(r => selectedIds.has(`${r.source}_${r.id}`));
    if (!records.length) { showMessage('Ничего не выбрано', 'error'); return; }

    const consultationRecords = records.filter(r => r.source === 'consultation');
    const dutyRecords = records.filter(r => r.source === 'duty');
    const wb = XLSX.utils.book_new();

    // Сводный отчет
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

    // Дежурка отдельно
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

    // Консультации отдельно
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

document.addEventListener('DOMContentLoaded', () => {
    const filterDateFrom = document.getElementById('filterDateFrom');
    const filterDateTo = document.getElementById('filterDateTo');
    const filterTable = document.getElementById('filterTable');
    const filterText = document.getElementById('filterText');
    const clearBtn = document.getElementById('clearFiltersBtn');

    function updateFilters() {
        currentFilters = {
            dateFrom: filterDateFrom?.value || '',
            dateTo: filterDateTo?.value || '',
            table: filterTable?.value || 'all',
            text: filterText?.value || ''
        };
        applyFilters();
    }

    filterDateFrom?.addEventListener('change', updateFilters);
    filterDateTo?.addEventListener('change', updateFilters);
    filterTable?.addEventListener('change', updateFilters);
    filterText?.addEventListener('input', updateFilters);
    clearBtn?.addEventListener('click', () => {
        if (filterDateFrom) filterDateFrom.value = '';
        if (filterDateTo) filterDateTo.value = '';
        if (filterTable) filterTable.value = 'all';
        if (filterText) filterText.value = '';
        updateFilters();
    });

    document.getElementById('exportSelectedBtn')?.addEventListener('click', exportSelected);
    document.getElementById('selectAllCheckbox')?.addEventListener('change', toggleSelectAll);

    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    const prevBtn2 = document.getElementById('prevPageBtn2');
    const nextBtn2 = document.getElementById('nextPageBtn2');

    prevBtn?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadAllData(); } });
    nextBtn?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; loadAllData(); } });
    prevBtn2?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; loadAllData(); } });
    nextBtn2?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; loadAllData(); } });

    loadAllData();
});